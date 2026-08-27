interface GoogleIdentityCredentialResponse {
  credential: string;
}

interface GoogleIdentityButtonOptions {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin" | "signup" | "continue_with" | "signin_with";
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string;
          callback: (response: GoogleIdentityCredentialResponse) => void;
        }) => void;
        renderButton: (
          parent: HTMLElement,
          options: GoogleIdentityButtonOptions,
        ) => void;
      };
    };
  };
}
