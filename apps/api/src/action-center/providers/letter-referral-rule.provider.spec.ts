import { PrismaService } from "../../prisma/prisma.service";
import { LetterReferralRuleProvider } from "./letter-referral-rule.provider";

const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("LetterReferralRuleProvider", () => {
  it("excludes archived letters and maps urgent priority correctly", async () => {
    const prisma = {
      letter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "letter-1",
            subject: "درخواست تمدید قرارداد",
            letterNumber: "1405-پ ت-0010",
            priority: "urgent",
            letterDate: new Date(),
          },
        ]),
      },
    };
    const provider = new LetterReferralRuleProvider(prisma as unknown as PrismaService);

    const items = await provider.getItems(USER_ID, "mine");

    expect(prisma.letter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { responsibleUserId: USER_ID, status: { not: "archived" } } }),
    );
    expect(items).toHaveLength(1);
    expect(items[0].sourceType).toBe("letter_referral");
    expect(items[0].source).toBe("documents");
    expect(items[0].priority).toBe("high"); // urgent → high طبق نگاشت اولویت نامه
  });
});
