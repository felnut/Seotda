interface KakaoShareLink {
  mobileWebUrl: string;
  webUrl: string;
}

interface KakaoShareFeedContent {
  title: string;
  description: string;
  imageUrl: string;
  link: KakaoShareLink;
}

interface KakaoShareButton {
  title: string;
  link: KakaoShareLink;
}

interface Window {
  Kakao?: {
    isInitialized: () => boolean;
    init: (javascriptKey: string) => void;
    Share: {
      sendDefault: (options: {
        objectType: "feed";
        content: KakaoShareFeedContent;
        buttons?: KakaoShareButton[];
      }) => void;
    };
  };
}
