import "./globals.css";
import Provider from "./provider";

export const metadata = {
  title: "SmartOps",
  description:
    "Smart Operations Management System",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="id">
      <body>
        <Provider>
          {children}
        </Provider>
      </body>
    </html>
  );
}