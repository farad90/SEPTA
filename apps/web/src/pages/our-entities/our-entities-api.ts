import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { OurEntity } from "../inquiries/rfq-types";

const KEY = ["our-entities-admin"];

export function useOurEntitiesAdmin() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get<OurEntity[]>("/our-entities-admin")).data,
  });
}

export interface OurEntityBody {
  entityName: string;
  shortCode: string;
  calendarType: "jalali" | "gregorian";
  country: string;
  status?: "active" | "inactive";
  entityNameEn?: string;
  address?: string;
  addressEn?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  postalCode?: string;
  registrationNumber?: string;
}

export function useOurEntityMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: KEY }),
      queryClient.invalidateQueries({ queryKey: ["our-entities"] }),
    ]);

  const create = useMutation({
    mutationFn: async (body: OurEntityBody) => {
      const { data } = await apiClient.post<OurEntity>("/our-entities-admin", body);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: Partial<OurEntityBody> & { id: string }) => {
      const { data } = await apiClient.patch<OurEntity>(`/our-entities-admin/${id}`, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/our-entities-admin/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
