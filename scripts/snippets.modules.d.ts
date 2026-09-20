// Stand-ins for packages a reader installs that this workspace does not. A
// script file, not a module, so each block declares a module instead of
// augmenting one. Keep them to what the documentation uses.
declare module "react-native" {
  export const AppState: {
    addEventListener: (
      type: "change",
      listener: (state: "active" | "background" | "inactive") => void,
    ) => { remove: () => void };
  };
}
