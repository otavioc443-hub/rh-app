export const certificatesService = {
  open(courseId: string) {
    window.open(`/api/lms/certificates/${courseId}`, "_blank", "noopener,noreferrer");
  },
};
