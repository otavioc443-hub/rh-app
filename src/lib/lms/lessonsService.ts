import { parseStorageRef } from "@/lib/lms/utils";

export const lessonsService = {
  getStorageMeta(contentUrl: string) {
    return parseStorageRef(contentUrl);
  },
};
