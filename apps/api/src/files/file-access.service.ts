import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";

/**
 * P0-E3-F1-T1/T2 — FilesController previously checked nothing beyond "is
 * logged in" for any file path. This resolves the one case that's actually
 * resolvable from a bare file path: folders named after an inquiry's
 * internal_number (the dominant real-world pattern per phase 49 — every
 * inquiry-related upload point passes folder=inquiry.internalNumber).
 *
 * ⚠️ Known, documented residual gap: files that don't sit in an
 * inquiry-named folder (the legacy year/month route — HR identity
 * documents, profile photos, catalog/partner/our-entity logos, chat
 * attachments, ...) carry no entity information in the path at all, so
 * there is nothing here to resolve ownership against. This is the same
 * limitation the CTO strategy report calls out explicitly: the durable
 * fix is signed, entity-scoped URLs (Phase 2), not path-based resolution.
 * `logAccessToUnscopedFile` exists so that, in the meantime, there is at
 * least an audit trail for accesses this service cannot authorize.
 */
@Injectable()
export class FileAccessService {
  private readonly logger = new Logger(FileAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * @param folder Already basename()-d by the controller.
   * @param requireEdit Upload (write) needs inquiry.edit; download (read) needs inquiry.view.
   * @returns true if access is allowed OR the folder isn't an inquiry-named
   * folder at all (see the residual-gap note above — this is a deliberate
   * fallback to today's "just needs auth" behavior, not a bug).
   */
  async canAccessInquiryFolder(
    folder: string,
    currentUserId: string,
    requireEdit = false,
  ): Promise<boolean> {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { internalNumber: folder },
      select: { id: true, salesExpertId: true, createdByUserId: true },
    });
    if (!inquiry) {
      return true;
    }

    const permissionKey = requireEdit ? "inquiry.edit" : "inquiry.view";
    const hasBasePermission = await this.permissions.hasPermission(currentUserId, permissionKey);
    if (!hasBasePermission) {
      return false;
    }

    const canViewAll = await this.permissions.hasPermission(currentUserId, "inquiry.view_all");
    if (canViewAll) {
      return true;
    }

    return inquiry.salesExpertId === currentUserId || inquiry.createdByUserId === currentUserId;
  }

  /** See the class-level note — this is a trail, not an authorization check. */
  logAccessToUnscopedFile(currentUserId: string, path: string): void {
    this.logger.log(`Unscoped file access — path carries no resolvable owner: user=${currentUserId} path=${path}`);
  }
}
