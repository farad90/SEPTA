import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

const KEY = ["profile", "me"];

export interface IdentityDocument {
  id: string;
  documentType: "national_id_card" | "birth_certificate_page";
  pageNumber: number | null;
  fileUrl: string;
  uploadedAt: string;
}

export interface MyProfile {
  id: string;
  fullName: string;
  fullNameEn: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  profilePhotoUrl: string | null;
  birthDate: string | null;
  nationalId: string | null;
  birthCertificateNo: string | null;
  address: string | null;
  permissionGroup: { groupName: string } | null;
  identityDocuments: IdentityDocument[];
}

export interface UpdateProfileBody {
  fullName?: string;
  fullNameEn?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  birthDate?: string;
  address?: string;
  nationalId?: string;
  birthCertificateNo?: string;
  profilePhotoUrl?: string | null;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export function useMyProfile() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<MyProfile>("/users/me")).data,
  });
}

export function useProfileMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const update = useMutation({
    mutationFn: async (body: UpdateProfileBody) => (await apiClient.patch<MyProfile>("/users/me", body)).data,
    onSuccess: invalidate,
  });

  const upsertDocument = useMutation({
    mutationFn: async (body: { documentType: IdentityDocument["documentType"]; pageNumber?: number; fileUrl: string }) =>
      (await apiClient.put<MyProfile>("/users/me/identity-documents", body)).data,
    onSuccess: invalidate,
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete<MyProfile>(`/users/me/identity-documents/${id}`)).data,
    onSuccess: invalidate,
  });

  const changePassword = useMutation({
    mutationFn: async (body: ChangePasswordBody) =>
      (await apiClient.post<{ success: boolean }>("/users/me/change-password", body)).data,
  });

  return { update, upsertDocument, deleteDocument, changePassword };
}
