import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { LetterNumberService } from "./letter-number.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CorrespondenceService } from "./correspondence.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";
const LETTER_ID = "22222222-2222-2222-2222-222222222222";

function buildPrisma() {
  return {
    letter: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    letterSigner: { createMany: jest.fn() },
    letterAuditLog: { create: jest.fn(), findMany: jest.fn() },
    letterWorkflowLog: { create: jest.fn(), findMany: jest.fn() },
    document: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(1) },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>, canViewAll = false) {
  const numberService = { nextNumber: jest.fn().mockResolvedValue("1405-پ ت-0001") };
  const permissions = { hasPermission: jest.fn().mockResolvedValue(canViewAll) };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const service = new CorrespondenceService(
    prisma as unknown as PrismaService,
    numberService as unknown as LetterNumberService,
    permissions as unknown as PermissionsService,
    notifications as unknown as NotificationsService,
  );
  return { service, numberService, permissions, notifications };
}

const BASE_LETTER = {
  id: LETTER_ID,
  letterNumber: null,
  type: "incoming",
  letterDate: new Date(),
  subject: "تست",
  department: "فروش",
  priority: "normal",
  status: "draft",
  description: null,
  senderOurEntity: null,
  senderPartner: { id: "p1", companyName: "شرکت الف", partnerType: "customer" },
  senderContact: null,
  receiverOurEntity: { id: "oe1", entityName: "پولاد تجهیز آپادانا", shortCode: "پ ت" },
  receiverPartner: null,
  receiverContact: null,
  issuingEntity: { id: "oe1", entityName: "پولاد تجهیز آپادانا", shortCode: "پ ت", calendarType: "jalali" },
  creator: { id: USER_ID, fullName: "کارشناس" },
  relatedInquiry: null,
  relatedShipment: null,
  createdAt: new Date(),
  responsibleUserId: null,
  responsibleUser: null,
  senderReferenceNumber: null,
  internalFromDepartment: null,
  internalToDepartment: null,
  signers: [],
  _count: { documents: 0 },
};

function txStub(prisma: ReturnType<typeof buildPrisma>) {
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      letter: { create: prisma.letter.create },
      letterSigner: { createMany: prisma.letterSigner.createMany },
      letterWorkflowLog: { create: prisma.letterWorkflowLog.create },
    }),
  );
}

describe("CorrespondenceService — اعتبارسنجی جهت‌محور فرستنده/گیرنده (فاز ۲۴)", () => {
  it("rejects an incoming letter whose sender isn't an external partner", async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.create(
        {
          type: "incoming",
          letterDate: "2026-07-10",
          subject: "تست",
          sender: {},
          receiver: { ourEntityId: "oe1" },
          issuingEntityId: "oe1",
          senderReferenceNumber: "REF-1",
          responsibleUserId: OTHER_USER_ID,
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an incoming letter missing senderReferenceNumber or responsibleUserId", async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.create(
        {
          type: "incoming",
          letterDate: "2026-07-10",
          subject: "تست",
          sender: { partnerId: "p1" },
          receiver: { ourEntityId: "oe1" },
          issuingEntityId: "oe1",
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts a well-formed incoming letter and logs the responsible-person referral", async () => {
    const prisma = buildPrisma();
    txStub(prisma);
    prisma.letter.create.mockResolvedValue({ ...BASE_LETTER, id: LETTER_ID });
    const { service, notifications } = buildService(prisma);

    await service.create(
      {
        type: "incoming",
        letterDate: "2026-07-10",
        subject: "تست",
        sender: { partnerId: "p1" },
        receiver: { ourEntityId: "oe1" },
        issuingEntityId: "oe1",
        senderReferenceNumber: "REF-1",
        responsibleUserId: OTHER_USER_ID,
      },
      USER_ID,
    );

    expect(prisma.letterWorkflowLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "referred", referredToUserId: OTHER_USER_ID }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OTHER_USER_ID, type: "letter_responsible_assigned" }),
    );
  });

  it("rejects an outgoing letter without at least one signer", async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.create(
        {
          type: "outgoing",
          letterDate: "2026-07-10",
          subject: "تست",
          sender: { ourEntityId: "oe1" },
          receiver: { partnerId: "p1" },
          issuingEntityId: "oe1",
          signerUserIds: [],
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates letter_signers rows for an outgoing letter", async () => {
    const prisma = buildPrisma();
    txStub(prisma);
    prisma.letter.create.mockResolvedValue({ ...BASE_LETTER, id: LETTER_ID, type: "outgoing" });
    const { service } = buildService(prisma);

    await service.create(
      {
        type: "outgoing",
        letterDate: "2026-07-10",
        subject: "تست",
        sender: { ourEntityId: "oe1" },
        receiver: { partnerId: "p1" },
        issuingEntityId: "oe1",
        signerUserIds: [USER_ID, OTHER_USER_ID],
      },
      USER_ID,
    );

    expect(prisma.letterSigner.createMany).toHaveBeenCalledWith({
      data: [
        { letterId: LETTER_ID, userId: USER_ID },
        { letterId: LETTER_ID, userId: OTHER_USER_ID },
      ],
    });
  });

  it("rejects an internal letter that still supplies company sender/receiver fields", async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.create(
        {
          type: "internal",
          letterDate: "2026-07-10",
          subject: "تست",
          sender: { ourEntityId: "oe1" },
          issuingEntityId: "oe1",
          internalFromDepartmentId: "d1",
          internalToDepartmentId: "d2",
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an internal letter whose from/to department are the same", async () => {
    const prisma = buildPrisma();
    const { service } = buildService(prisma);

    await expect(
      service.create(
        {
          type: "internal",
          letterDate: "2026-07-10",
          subject: "تست",
          issuingEntityId: "oe1",
          internalFromDepartmentId: "d1",
          internalToDepartmentId: "d1",
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("CorrespondenceService — ثبت رسمی", () => {
  it("rejects registering a letter that isn't in draft status", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue({ ...BASE_LETTER, status: "registered" });
    const { service } = buildService(prisma);

    await expect(service.register(LETTER_ID, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects registering an incoming letter with no attached documents (فاز ۲۴)", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue({ ...BASE_LETTER, type: "incoming" });
    prisma.document.count.mockResolvedValue(0);
    const { service } = buildService(prisma);

    await expect(service.register(LETTER_ID, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("فاز ۵۲: نامه ارسالی رو حتی بدون هیچ سند پیوستی ثبت رسمی می‌کنه — شماره باید قبل از نوشتن نامه در دسترس باشه", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue({ ...BASE_LETTER, type: "outgoing" });
    prisma.document.count.mockResolvedValue(0);
    const txLetter = { update: jest.fn() };
    const txWorkflow = { create: jest.fn() };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ letter: txLetter, letterWorkflowLog: txWorkflow }),
    );
    prisma.document.findMany.mockResolvedValue([]);
    prisma.letterWorkflowLog.findMany.mockResolvedValue([]);
    prisma.letterAuditLog.findMany.mockResolvedValue([]);
    const { service, numberService } = buildService(prisma);

    await service.register(LETTER_ID, USER_ID);

    expect(numberService.nextNumber).toHaveBeenCalled();
    expect(txLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "registered" }) }),
    );
  });

  it("issues a number and logs a registered workflow entry", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue(BASE_LETTER);
    prisma.document.count.mockResolvedValue(1);
    const txLetter = { update: jest.fn() };
    const txWorkflow = { create: jest.fn() };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ letter: txLetter, letterWorkflowLog: txWorkflow }),
    );
    prisma.document.findMany.mockResolvedValue([]);
    prisma.letterWorkflowLog.findMany.mockResolvedValue([]);
    prisma.letterAuditLog.findMany.mockResolvedValue([]);
    const { service, numberService } = buildService(prisma);

    await service.register(LETTER_ID, USER_ID);

    expect(numberService.nextNumber).toHaveBeenCalledWith(expect.anything(), "oe1", "jalali", "پ ت");
    expect(txLetter.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "registered" }) }),
    );
    expect(txWorkflow.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "registered", performedBy: USER_ID }) }),
    );
  });
});

describe("CorrespondenceService — فیلتر دسترسی بر اساس واحد", () => {
  it("filters the list by the user's permission group name when lacking view_all", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "فروش" } });
    prisma.letter.findMany.mockResolvedValue([]);
    const { service, permissions } = buildService(prisma, false);

    await service.list({}, USER_ID);

    expect(permissions.hasPermission).toHaveBeenCalledWith(USER_ID, "correspondence.view_all");
    const callArgs = prisma.letter.findMany.mock.calls[0][0];
    expect(callArgs.where.AND[0]).toEqual({ OR: [{ department: "فروش" }, { responsibleUserId: USER_ID }] });
  });

  it("does not restrict department when the user has view_all", async () => {
    const prisma = buildPrisma();
    prisma.letter.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma, true);

    await service.list({}, USER_ID);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    const callArgs = prisma.letter.findMany.mock.calls[0][0];
    expect(callArgs.where.AND[0]).toEqual({});
  });

  it("throws NotFound when viewing a letter outside the user's department (no view_all)", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue({ ...BASE_LETTER, department: "بازرگانی" });
    prisma.user.findUnique.mockResolvedValue({ permissionGroup: { groupName: "فروش" } });
    const { service } = buildService(prisma, false);

    await expect(service.getById(LETTER_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows the responsible user to view an incoming letter outside their department (فاز ۲۴)", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue({
      ...BASE_LETTER,
      department: null,
      responsibleUserId: USER_ID,
    });
    prisma.document.findMany.mockResolvedValue([]);
    prisma.letterWorkflowLog.findMany.mockResolvedValue([]);
    prisma.letterAuditLog.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma, false);

    await expect(service.getById(LETTER_ID, USER_ID)).resolves.toBeDefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("CorrespondenceService — Audit Log خودکار", () => {
  it("records a 'viewed' entry on getById", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue(BASE_LETTER);
    prisma.document.findMany.mockResolvedValue([]);
    prisma.letterWorkflowLog.findMany.mockResolvedValue([]);
    prisma.letterAuditLog.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma, true);

    await service.getById(LETTER_ID, USER_ID);

    expect(prisma.letterAuditLog.create).toHaveBeenCalledWith({
      data: { letterId: LETTER_ID, userId: USER_ID, action: "viewed" },
    });
  });

  it("records an 'edited' entry on update", async () => {
    const prisma = buildPrisma();
    prisma.letter.findUnique.mockResolvedValue(BASE_LETTER);
    prisma.document.findMany.mockResolvedValue([]);
    prisma.letterWorkflowLog.findMany.mockResolvedValue([]);
    prisma.letterAuditLog.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma);

    await service.update(LETTER_ID, { subject: "موضوع جدید" }, USER_ID);

    expect(prisma.letterAuditLog.create).toHaveBeenCalledWith({
      data: { letterId: LETTER_ID, userId: USER_ID, action: "edited" },
    });
  });
});
