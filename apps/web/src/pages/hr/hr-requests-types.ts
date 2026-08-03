export interface MyEmployee {
  id: string;
  fullName: string;
  // null یعنی هنوز شماره پرسنلی تخصیص داده نشده — یعنی هنوز رسماً «کارمند شرکت» نیستید
  employeeNumber: string | null;
  directManagerId: string | null;
  nationalId: string | null;
  birthDate: string | null;
  gender: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  maritalStatus: string | null;
  militaryServiceStatus: string | null;
  educationLevel: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export interface LeaveType {
  id: string;
  typeName: string;
  isPaid: boolean;
  annualEntitlementDays: string | null;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  entitledDays: string;
  usedDays: string;
  leaveType: LeaveType;
}

export const REQUEST_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "در انتظار تأیید", className: "bg-warningSoft text-warning" },
  approved: { label: "تأیید شده", className: "bg-successSoft text-success" },
  active: { label: "فعال (در حال کسر اقساط)", className: "bg-successSoft text-success" },
  settled: { label: "تسویه شده", className: "bg-border text-textSecondary" },
  rejected: { label: "رد شده", className: "bg-danger/10 text-danger" },
  cancelled: { label: "لغو شده", className: "bg-border text-textSecondary" },
  completed: { label: "انجام شده", className: "bg-successSoft text-success" },
  paid: { label: "پرداخت شده", className: "bg-successSoft text-success" },
};

export const HR_REQUEST_TYPE_LABEL: Record<string, string> = {
  certificate: "گواهی اشتغال",
  salary_advance: "پیش‌پرداخت حقوق",
  equipment: "درخواست تجهیزات",
  other: "سایر",
};

interface WithApprover {
  status: string;
  approver: { id: string; fullName: string } | null;
  employee?: { id: string; fullName: string };
}

export interface LeaveRequest extends WithApprover {
  id: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysCount: string;
  reason: string | null;
  attachmentFileUrl: string | null;
  approvedAt: string | null;
  createdAt: string;
  leaveType: LeaveType;
}

export interface MissionRequest extends WithApprover {
  id: string;
  destination: string;
  purpose: string | null;
  startDate: string;
  endDate: string;
  transportationMethod: string | null;
  estimatedCost: string | null;
  currencyCode: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface OvertimeRecord extends WithApprover {
  id: string;
  workDate: string;
  hours: string;
  reason: string | null;
  rateMultiplier: string;
  calculatedAmount: string | null;
  currencyCode: string | null;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  status: string;
  source: string;
  notes: string | null;
}

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: "حاضر",
  absent: "غایب",
  on_leave: "مرخصی",
  holiday: "تعطیل",
  mission: "مأموریت",
};

export interface LoanInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: string;
  status: string;
}

export interface EmployeeLoan extends WithApprover {
  id: string;
  loanAmount: string;
  currencyCode: string;
  requestDate: string;
  reason: string | null;
  installmentCount: number;
  monthlyInstallment: string;
  startDeductionDate: string | null;
  approvedAt: string | null;
  createdAt: string;
  installments: LoanInstallment[];
}

export interface HrRequest extends WithApprover {
  id: string;
  requestType: string;
  description: string;
  createdAt: string;
}

export interface BenefitType {
  id: string;
  benefitName: string;
  isRecurringDefault: boolean;
}

export interface EmployeeBenefit {
  id: string;
  benefitTypeId: string;
  amount: string;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isRecurring: boolean;
  notes: string | null;
  benefitType: BenefitType;
}

export interface EmployeeChild {
  id: string;
  employeeId: string;
  fullName: string | null;
  birthDate: string;
}

export interface DeductionType {
  id: string;
  deductionName: string;
  isRecurringDefault: boolean;
}

export interface EmployeeDeduction {
  id: string;
  deductionTypeId: string;
  amount: string;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isRecurring: boolean;
  relatedLoanId: string | null;
  notes: string | null;
  deductionType: DeductionType;
}
