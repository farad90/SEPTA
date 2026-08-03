import { ProposalService } from "../proposal/proposal.service";

export type ProposalDocumentData = Awaited<ReturnType<ProposalService["getDocumentData"]>>;
