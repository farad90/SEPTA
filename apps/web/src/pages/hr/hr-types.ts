export const GENDER_LABEL: Record<string, string> = {
  male: "مرد",
  female: "زن",
};

export const MARITAL_STATUS_LABEL: Record<string, string> = {
  single: "مجرد",
  married: "متأهل",
};

export const MILITARY_SERVICE_LABEL: Record<string, string> = {
  completed: "پایان خدمت",
  exempt: "معافیت",
  in_progress: "در حال خدمت",
  not_applicable: "مشمول نیست",
};

export const EMPLOYMENT_STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "فعال", className: "bg-successSoft text-success" },
  on_leave: { label: "مرخصی", className: "bg-warningSoft text-warning" },
  terminated: { label: "پایان همکاری", className: "bg-border text-textSecondary" },
};

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  permanent: "دائم",
  fixed_term: "موقت",
  project_based: "پروژه‌ای",
  probation: "آزمایشی",
};

export const CONTRACT_STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "فعال", className: "bg-successSoft text-success" },
  expired: { label: "منقضی‌شده", className: "bg-border text-textSecondary" },
  terminated: { label: "فسخ‌شده", className: "bg-danger/10 text-danger" },
};

export interface DepartmentSummary {
  id: string;
  departmentName: string;
}

export interface Department {
  id: string;
  departmentName: string;
  parentDepartmentId: string | null;
  ourEntityId: string;
  status: "active" | "inactive";
  headEmployeeId: string | null;
  createdAt: string;
  headEmployee: { id: string; fullName: string } | null;
  ourEntity: { id: string; entityName: string };
  parentDepartment?: DepartmentSummary | null;
  _count?: { employees: number };
}

export interface EmployeeContract {
  id: string;
  employeeId: string;
  ourEntityId: string;
  contractType: string;
  positionTitle: string | null;
  startDate: string;
  endDate: string | null;
  baseSalary: string;
  salaryCurrency: string;
  workLocation: string | null;
  status: string;
  fileUrl: string | null;
  signedDate: string | null;
}

export interface Employee {
  id: string;
  userId: string | null;
  // ⚠️ null یعنی این پرسنل هنوز فقط «کاربر سامانه»ست — منابع انسانی هنوز شماره پرسنلی
  // تخصیص نداده، پس رسماً «کارمند شرکت» محسوب نمی‌شه
  employeeNumber: string | null;
  fullName: string;
  nationalId: string | null;
  birthDate: string | null;
  gender: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  maritalStatus: string | null;
  militaryServiceStatus: string | null;
  educationLevel: string | null;
  profilePhotoUrl: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  departmentId: string | null;
  positionTitle: string | null;
  directManagerId: string | null;
  ourEntityId: string | null;
  hireDate: string | null;
  terminationDate: string | null;
  employmentStatus: "active" | "on_leave" | "terminated";
  department: DepartmentSummary | null;
  directManager: { id: string; fullName: string } | null;
  ourEntity: { id: string; entityName: string } | null;
  contracts: EmployeeContract[];
}

export interface SimilarEmployee {
  id: string;
  fullName: string;
  employeeNumber: string | null;
  similarity: number;
}
