// پکیج puppeteer با ESM export می‌شه و Jest/ts-jest نمی‌تونه پارسش کنه؛
// چون تست‌های سرویس‌ها Puppeteer واقعی رو اجرا نمی‌کنن (فقط PdfRendererService رو mock می‌کنن)،
// یک stub خالی جایگزینش می‌شه تا import در module scope باعث خطای پارس نشه.
module.exports = {
  launch: async () => ({
    newPage: async () => ({
      setContent: async () => {},
      evaluateHandle: async () => {},
      pdf: async () => Buffer.from(""),
    }),
    close: async () => {},
  }),
};
