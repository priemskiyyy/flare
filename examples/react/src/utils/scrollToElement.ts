export const scrollToElement = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};
