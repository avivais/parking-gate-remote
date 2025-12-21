"use client";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
            <div className="pt-14">
                {children}
            </div>
        </div>
    );
}

