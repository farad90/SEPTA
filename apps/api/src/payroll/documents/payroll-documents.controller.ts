import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../permissions/permissions.guard";
import { RequirePermissions } from "../../permissions/require-permissions.decorator";
import { PayrollDocumentsService } from "./payroll-documents.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("payroll")
export class PayrollDocumentsController {
  constructor(private readonly service: PayrollDocumentsService) {}

  @RequirePermissions("payroll_engine.view")
  @Post("results/:id/payslip/generate")
  generatePayslip(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.generatePayslipPdf(id);
  }

  @RequirePermissions("payroll_engine.view")
  @Post("periods/:id/payroll-list/generate")
  generatePayrollList(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.generatePayrollListExcel(id);
  }
}
