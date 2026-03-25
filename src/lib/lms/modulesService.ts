export const modulesService = {
  normalizeSortOrder<T extends { sort_order: number }>(rows: T[]) {
    return rows.map((row, index) => ({ ...row, sort_order: index + 1 }));
  },
};
