export const OAUTH = {
  linkedin: {
    label: "LinkedIn",
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
    auth: "https://www.linkedin.com/oauth/v2/authorization",
    token: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid profile w_member_social",
    clientKey: "client_id"
  },
  facebook: {
    label: "Facebook",
    clientId: "META_APP_ID",
    clientSecret: "META_APP_SECRET",
    auth: "https://www.facebook.com/v24.0/dialog/oauth",
    token: "https://graph.facebook.com/v24.0/oauth/access_token",
    scope: "pages_show_list pages_read_engagement pages_manage_posts instagram_basic instagram_content_publish business_management whatsapp_business_management whatsapp_business_messaging",
    clientKey: "client_id",
    meta: true
  },
  instagram: {
    label: "Instagram",
    clientId: "META_APP_ID",
    clientSecret: "META_APP_SECRET",
    auth: "https://www.facebook.com/v24.0/dialog/oauth",
    token: "https://graph.facebook.com/v24.0/oauth/access_token",
    scope: "pages_show_list pages_read_engagement instagram_basic instagram_content_publish",
    clientKey: "client_id",
    meta: true
  },
  threads: {
    label: "Threads",
    clientId: "THREADS_APP_ID",
    clientSecret: "THREADS_APP_SECRET",
    auth: "https://threads.net/oauth/authorize",
    token: "https://graph.threads.net/oauth/access_token",
    scope: "threads_basic threads_content_publish",
    clientKey: "client_id"
  },
  pinterest: {
    label: "Pinterest",
    clientId: "PINTEREST_APP_ID",
    clientSecret: "PINTEREST_APP_SECRET",
    auth: "https://www.pinterest.com/oauth/",
    token: "https://api.pinterest.com/v5/oauth/token",
    scope: "boards:read pins:read pins:write",
    clientKey: "client_id",
    basic: true
  },
  youtube: {
    label: "YouTube",
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    clientKey: "client_id",
    google: true
  },
  tiktok: {
    label: "TikTok",
    clientId: "TIKTOK_CLIENT_KEY",
    clientSecret: "TIKTOK_CLIENT_SECRET",
    auth: "https://www.tiktok.com/v2/auth/authorize/",
    token: "https://open.tiktokapis.com/v2/oauth/token/",
    scope: "user.info.basic,video.upload,video.publish",
    clientKey: "client_key",
    tiktok: true
  },
  x: {
    label: "X",
    clientId: "X_CLIENT_ID",
    clientSecret: "X_CLIENT_SECRET",
    auth: "https://twitter.com/i/oauth2/authorize",
    token: "https://api.x.com/2/oauth2/token",
    scope: "tweet.read tweet.write users.read offline.access",
    clientKey: "client_id",
    pkce: true
  }
};

export function envReady(id) {
  const c = OAUTH[id];
  return Boolean(c && process.env[c.clientId] && process.env[c.clientSecret]);
}
