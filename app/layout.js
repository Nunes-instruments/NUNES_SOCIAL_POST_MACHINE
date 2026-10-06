import "./globals.css";

export const metadata = {
  title: "NUNES Social Post Machine",
  description: "Create once, adapt for every platform, and publish through connected social accounts."
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
