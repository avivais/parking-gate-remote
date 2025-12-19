import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminHeader";

export const metadata: Metadata = {
    title: "מצפה 6-8 • ניהול",
    description: "ניהול משתמשים ולוגים",
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <AdminHeader />
            {children}
        </>
    );
}

