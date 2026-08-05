import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Response } from "express";
import { StorageService } from "./storage.service";
import { FileAccessService } from "./file-access.service";
import { FilesController } from "./files.controller";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function buildController() {
  const storage = { save: jest.fn(), openStream: jest.fn() };
  const fileAccess = { canAccessInquiryFolder: jest.fn(), logAccessToUnscopedFile: jest.fn() };
  const controller = new FilesController(
    storage as unknown as StorageService,
    fileAccess as unknown as FileAccessService,
  );
  return { controller, storage, fileAccess };
}

function fakeStream() {
  return { pipe: jest.fn() };
}

function fakeResponse() {
  return { setHeader: jest.fn() } as unknown as Response;
}

describe("FilesController — P0-E3-F1-T1/T2: IDOR fix", () => {
  describe("upload", () => {
    it("rejects with no file", async () => {
      const { controller } = buildController();
      await expect(
        controller.upload({ userId: USER_ID }, undefined, "INQ-2026-0001"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("uploads without a permission check when no folder is given (legacy year/month path)", async () => {
      const { controller, storage, fileAccess } = buildController();
      storage.save.mockResolvedValue({ fileUrl: "2026/07/x.pdf", fileName: "x.pdf" });
      const file = { originalname: "x.pdf", buffer: Buffer.from("x") } as Express.Multer.File;

      await controller.upload({ userId: USER_ID }, file, undefined);

      expect(fileAccess.canAccessInquiryFolder).not.toHaveBeenCalled();
      expect(storage.save).toHaveBeenCalled();
    });

    it("rejects an upload into an inquiry folder the caller can't edit", async () => {
      const { controller, storage, fileAccess } = buildController();
      fileAccess.canAccessInquiryFolder.mockResolvedValue(false);
      const file = { originalname: "x.pdf", buffer: Buffer.from("x") } as Express.Multer.File;

      await expect(
        controller.upload({ userId: USER_ID }, file, "INQ-2026-0001"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.save).not.toHaveBeenCalled();
      expect(fileAccess.canAccessInquiryFolder).toHaveBeenCalledWith("INQ-2026-0001", USER_ID, true);
    });

    it("allows an upload into an inquiry folder the caller can edit", async () => {
      const { controller, storage, fileAccess } = buildController();
      fileAccess.canAccessInquiryFolder.mockResolvedValue(true);
      storage.save.mockResolvedValue({ fileUrl: "INQ-2026-0001/x.pdf", fileName: "x.pdf" });
      const file = { originalname: "x.pdf", buffer: Buffer.from("x") } as Express.Multer.File;

      await controller.upload({ userId: USER_ID }, file, "INQ-2026-0001");

      expect(storage.save).toHaveBeenCalled();
    });

    it("sanitizes a client-supplied folder containing path traversal before the access check", async () => {
      const { controller, fileAccess } = buildController();
      fileAccess.canAccessInquiryFolder.mockResolvedValue(false);
      const file = { originalname: "x.pdf", buffer: Buffer.from("x") } as Express.Multer.File;

      await expect(
        controller.upload({ userId: USER_ID }, file, "../../etc/INQ-2026-0001"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // basename() strips the traversal — only the final path segment is ever checked/used
      expect(fileAccess.canAccessInquiryFolder).toHaveBeenCalledWith("INQ-2026-0001", USER_ID, true);
    });
  });

  describe("downloadFromFolder — the headline audit finding", () => {
    it("rejects a request for a folder outside the caller's scope", async () => {
      const { controller, storage, fileAccess } = buildController();
      fileAccess.canAccessInquiryFolder.mockResolvedValue(false);

      await expect(
        controller.downloadFromFolder("INQ-2026-0099", "x.pdf", fakeResponse(), { userId: USER_ID }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.openStream).not.toHaveBeenCalled();
    });

    it("serves the file when the caller is in scope", async () => {
      const { controller, storage, fileAccess } = buildController();
      fileAccess.canAccessInquiryFolder.mockResolvedValue(true);
      const stream = fakeStream();
      storage.openStream.mockReturnValue({ stream, absolutePath: "/x" });
      const res = fakeResponse();

      await controller.downloadFromFolder("INQ-2026-0001", "x.pdf", res, { userId: USER_ID });

      expect(storage.openStream).toHaveBeenCalledWith("INQ-2026-0001/x.pdf");
      expect(stream.pipe).toHaveBeenCalledWith(res);
    });
  });

  describe("download — legacy year/month path (documented residual gap)", () => {
    it("logs the access and still serves the file (no ownership resolvable from a bare path)", () => {
      const { controller, storage, fileAccess } = buildController();
      const stream = fakeStream();
      storage.openStream.mockReturnValue({ stream, absolutePath: "/x" });
      const res = fakeResponse();

      controller.download("2026", "07", "x.pdf", res, { userId: USER_ID });

      expect(fileAccess.logAccessToUnscopedFile).toHaveBeenCalledWith(USER_ID, "2026/07/x.pdf");
      expect(stream.pipe).toHaveBeenCalledWith(res);
    });
  });
});
