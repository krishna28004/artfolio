"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Heart, Images, LogIn, Mail, Monitor, PenLine, UserRound, X, type LucideIcon } from "lucide-react";
import styles from "./Sidebar.module.css";

const menuItems: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Artworks", href: "/artworks", icon: Images },
    { label: "Saved Collection", href: "/saved", icon: Heart },
    { label: "Digital Exhibition", href: "/exhibition", icon: Monitor },
    { label: "Commission", href: "/commission", icon: PenLine },
    { label: "Learning", href: "/learning", icon: BookOpen },
    { label: "Studio Login", href: "/admin/login", icon: LogIn },
    { label: "About", href: "/#about", icon: UserRound },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [currentHash, setCurrentHash] = useState("");
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const updateHash = () => setCurrentHash(window.location.hash);
        updateHash();
        window.addEventListener("hashchange", updateHash);
        return () => window.removeEventListener("hashchange", updateHash);
    }, [pathname]);

    useEffect(() => {
        queueMicrotask(() => {
            setMounted(true);
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const focusFrame = requestAnimationFrame(() => closeRef.current?.focus());
        const trapFocus = (event: KeyboardEvent) => {
            if (event.key !== "Tab" || !panelRef.current) return;
            const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled])'
            ));
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        };
        window.addEventListener("keydown", trapFocus);
        return () => { cancelAnimationFrame(focusFrame); window.removeEventListener("keydown", trapFocus); };
    }, [isOpen]);

    if (!mounted) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-700 ease-editorial ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div
                ref={panelRef}
                id="site-menu-panel"
                role="dialog"
                aria-label="Site menu"
                aria-modal={isOpen}
                aria-hidden={!isOpen}
                inert={!isOpen}
                className={`${styles.panel} ${isOpen ? styles.panelOpen : styles.panelClosed}`}
            >
                <div className={styles.topBar}>
                    <Link href="/" onClick={onClose} className={styles.wordmark} aria-label="Artfolio home">ARTFOLIO</Link>
                    <button
                        ref={closeRef}
                        onClick={onClose}
                        aria-label="Close menu"
                        className={styles.closeButton}
                    >
                        <X aria-hidden="true" size={27} strokeWidth={1.1} />
                    </button>
                </div>

                <div className={styles.sectionHeading}>
                    <span>Explore Artfolio</span>
                    <span className={styles.headingRule} aria-hidden="true" />
                    <span className={styles.headingDiamond} aria-hidden="true" />
                </div>

                <nav aria-label="Site navigation" className={styles.menuList}>
                    {menuItems.map(({ label, href, icon: Icon }) => {
                        const isCurrent = href === `${pathname}${currentHash}`;
                        return <Link
                            key={label}
                            href={href}
                            onClick={onClose}
                            aria-current={isCurrent ? "page" : undefined}
                            className={`${styles.menuLink} ${isCurrent ? styles.activeLink : ""}`}
                        >
                            <Icon aria-hidden="true" size={29} strokeWidth={1.45} className={styles.menuIcon} />
                            <span className={styles.menuDivider} aria-hidden="true" />
                            <span className={styles.menuLabel}>{label}</span>
                            <ArrowRight aria-hidden="true" size={25} strokeWidth={1.25} className={styles.menuArrow} />
                        </Link>;
                    })}
                </nav>

                <div className={styles.contactBlock}>
                    <p className={styles.contactLabel}>Contact</p>
                    <a href="mailto:krishnakumar2811004@gmail.com" className={styles.contactLink}>
                        <Mail aria-hidden="true" size={25} strokeWidth={1.5} />
                        <span>krishnakumar2811004@gmail.com</span>
                    </a>
                </div>
            </div>
        </>
    );
}
