import type { OperationIR } from '../../api-types.ts';

export type { OperationDetail, OperationSummary } from '../../api-types.ts';

export type ParameterLocationName = OperationIR['parameters'][number]['in'];
export type ResponseLike = OperationIR['responses'][number];
