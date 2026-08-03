import { PayrollPipelineContext } from "./pipeline-context";

export interface PayrollPipelineStage {
  readonly name: string;
  execute(ctx: PayrollPipelineContext): Promise<void>;
}
