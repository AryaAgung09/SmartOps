import "./globals.css";
import "./ui-system.css";
import Provider from "./provider";

export const metadata = {
  title: "SmartOps | Operations Management",
  description:
    "An enterprise-style operations platform for people, attendance, requests, leave, payroll, finance, and documents.",
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