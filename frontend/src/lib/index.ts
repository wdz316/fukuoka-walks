import { createApi } from "./api";
import { createMockApi } from "./mock";
import { USE_MOCK } from "./config";
import type { Api } from "./types";

export type {
  Api,
  ApiError,
  Destination,
  ExportFormat,
  HolidayType,
  PlaceInfo,
  Preferences,
  RecommendRequest,
  Recommendation,
  Season,
  Trip,
  AiProvider,
} from "./types";

export const api: Api = USE_MOCK ? createMockApi() : createApi();
