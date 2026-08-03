import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { Paged } from "../../lib/types";
import {
  DiscussionEntry,
  InquiryDetail,
  InquiryItemDraft,
  InquiryListRow,
} from "./inquiry-types";

const KEY = ["inquiries"];

export interface InquiryListFilters {
  q?: string;
  status?: string;
  buyerId?: string;
  salesExpertId?: string;
  sortBy?: "deadline" | "createdAt";
  sortDir?: "asc" | "desc";
}

export function useInquiries(filters: InquiryListFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Paged<InquiryListRow>>("/inquiries", {
        // pageSize بزرگ چون مرتب‌سازی/فیلتر ستون‌ها (فاز ۵۳) سمت کلاینت روی کل لیست انجام می‌شه
        params: { ...filters, q: filters.q || undefined, pageSize: 1000 },
      });
      return data;
    },
  });
}

/** خروجی اکسل لیست — همون فیلترهای سرور (q/status/buyer/salesExpert)؛ فیلتر/مرتب‌سازی ستونی سمت کلاینته و در Export اعمال نمی‌شه */
export async function exportInquiries(filters: Pick<InquiryListFilters, "q" | "status" | "buyerId" | "salesExpertId">) {
  const { data } = await apiClient.get("/inquiries/export", {
    params: { ...filters, q: filters.q || undefined },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "inquiries.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

export function useInquiry(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => (await apiClient.get<InquiryDetail>(`/inquiries/${id}`)).data,
    enabled: !!id,
  });
}

export function useDiscussions(inquiryId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, inquiryId, "discussions"],
    queryFn: async () =>
      (await apiClient.get<DiscussionEntry[]>(`/inquiries/${inquiryId}/discussions`)).data,
    enabled: !!inquiryId,
    refetchInterval: 20_000, // فید فعالیت — polling سبک تا اعلان real-time دامنه ۹
  });
}

export interface CreateInquiryBody {
  inquiryNumber?: string;
  buyerId: string;
  buyerContactId?: string;
  subject: string;
  offerEndDate: string;
  extendedOfferEndDate?: string | null;
  isEquivalentAccepted?: boolean;
  settlementTerms?: string;
  advancePaymentAvailable?: boolean;
  description?: string;
  salesExpertId?: string;
  inquiryStartDate: string;
  channel?: string;
  urgency?: string;
  items: InquiryItemDraft[];
}

/** پرونده‌های حذف‌شده (سطل بازیافت) — فقط با inquiry.purge */
export function useDeletedInquiries() {
  return useQuery({
    queryKey: [...KEY, "deleted"],
    queryFn: async () =>
      (
        await apiClient.get<
          (InquiryListRow & { deletedAt: string; deletedByName: string | null })[]
        >("/inquiries-deleted")
      ).data,
  });
}

export function useInquiryMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (body: CreateInquiryBody) =>
      (await apiClient.post<InquiryDetail>("/inquiries", body)).data,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: Partial<CreateInquiryBody> & { id: string; status?: string }) =>
      (await apiClient.patch<InquiryDetail>(`/inquiries/${id}`, body)).data,
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: async ({ id, salesExpertId }: { id: string; salesExpertId: string }) =>
      (await apiClient.patch<InquiryDetail>(`/inquiries/${id}/assign`, { salesExpertId })).data,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inquiries/${id}`);
    },
    onSuccess: invalidate,
  });

  const restore = useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/inquiries/${id}/restore`)).data,
    onSuccess: invalidate,
  });

  const decline = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await apiClient.post<InquiryDetail>(`/inquiries/${id}/decline`, { reason })).data,
    onSuccess: invalidate,
  });

  const purge = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inquiries/${id}/purge`);
    },
    onSuccess: invalidate,
  });

  const addItem = useMutation({
    mutationFn: async ({ inquiryId, ...body }: InquiryItemDraft & { inquiryId: string }) =>
      (await apiClient.post(`/inquiries/${inquiryId}/items`, body)).data,
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: async ({ itemId, ...body }: Partial<InquiryItemDraft> & { itemId: string }) =>
      (await apiClient.patch(`/inquiry-items/${itemId}`, body)).data,
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await apiClient.delete(`/inquiry-items/${itemId}`);
    },
    onSuccess: invalidate,
  });

  const addItemDocument = useMutation({
    mutationFn: async ({
      itemId,
      fileUrl,
      fileName,
    }: {
      itemId: string;
      fileUrl: string;
      fileName?: string;
    }) => (await apiClient.post(`/inquiry-items/${itemId}/documents`, { fileUrl, fileName })).data,
    onSuccess: invalidate,
  });

  const removeItemDocument = useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/inquiry-item-documents/${documentId}`);
    },
    onSuccess: invalidate,
  });

  const addDocument = useMutation({
    mutationFn: async ({
      inquiryId,
      fileUrl,
      fileName,
    }: {
      inquiryId: string;
      fileUrl: string;
      fileName?: string;
    }) => (await apiClient.post(`/inquiries/${inquiryId}/documents`, { fileUrl, fileName })).data,
    onSuccess: invalidate,
  });

  const removeDocument = useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/inquiry-documents/${documentId}`);
    },
    onSuccess: invalidate,
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      inquiryId,
      commentText,
      mentionedUserId,
      tag,
    }: {
      inquiryId: string;
      commentText: string;
      mentionedUserId?: string;
      tag?: string;
    }) =>
      (
        await apiClient.post<DiscussionEntry>(`/inquiries/${inquiryId}/discussions`, {
          commentText,
          mentionedUserId,
          tag,
        })
      ).data,
    onSuccess: invalidate,
  });

  return {
    create,
    update,
    assign,
    remove,
    restore,
    decline,
    purge,
    addItem,
    updateItem,
    removeItem,
    addItemDocument,
    removeItemDocument,
    addDocument,
    removeDocument,
    sendMessage,
  };
}

/**
 * آپلود فایل به FilesModule — خروجی fileUrl برای ثبت در سند قلم.
 * `folder` اختیاریه — فاز ۴۹: وقتی پر باشه (معمولاً شماره داخلی استعلام)، فایل به‌جای
 * پوشه‌بندی سال/ماه، داخل یک پوشه‌ی مشترک با نام همون پرونده ذخیره می‌شه.
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
  folder?: string,
): Promise<{ fileUrl: string; fileName: string }> {
  const form = new FormData();
  form.append("file", file);
  if (folder) form.append("folder", folder);
  const { data } = await apiClient.post<{ fileUrl: string; fileName: string }>("/files", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return data;
}

/** دانلود محافظت‌شده — با axios (توکن‌دار) و ذخیره Blob */
export async function downloadFile(fileUrl: string, fileName: string | null) {
  const { data } = await apiClient.get(`/files/${fileUrl}`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName ?? fileUrl.split("/").pop() ?? "file";
  link.click();
  URL.revokeObjectURL(url);
}
