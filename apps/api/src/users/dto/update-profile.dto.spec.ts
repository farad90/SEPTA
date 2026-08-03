import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { UpdateProfileDto } from "./update-profile.dto";

describe("UpdateProfileDto — mobile validation", () => {
  it("rejects a mobile number that doesn't start with 09", async () => {
    const dto = plainToInstance(UpdateProfileDto, { mobile: "12345678901" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "mobile")).toBe(true);
  });

  it("rejects a mobile number with the wrong length", async () => {
    const dto = plainToInstance(UpdateProfileDto, { mobile: "0912345" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "mobile")).toBe(true);
  });

  it("accepts a valid 09xxxxxxxxx mobile number", async () => {
    const dto = plainToInstance(UpdateProfileDto, { mobile: "09123456789" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "mobile")).toBe(false);
  });

  it("accepts an undefined mobile (optional field)", async () => {
    const dto = plainToInstance(UpdateProfileDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "mobile")).toBe(false);
  });
});
