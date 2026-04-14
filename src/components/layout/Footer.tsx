export function Footer() {
    return (
        <footer className="w-full border-t border-white/5 py-12 lg:py-16 mt-auto">
            <div className="container px-4 md:px-8 max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex flex-col items-center md:items-start">
                    <span className="font-serif text-[20px] text-primary tracking-[-0.02em] mb-1">Artfolio</span>
                    <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted">&copy; {new Date().getFullYear()} Fine Arts Vault</span>
                </div>
                <div className="flex gap-8">
                    <a href="https://www.instagram.com/krishnakumar_artss?igsh=MTk4N2o3czloN2kyMA==" target="_blank" rel="noopener noreferrer" className="font-sans text-[12px] uppercase tracking-widest text-muted hover:text-white transition-colors duration-500">Instagram</a>
                    <a href="https://mail.google.com/mail/?view=cm&to=krishnakumar2811004@gmail.com" target="_blank" rel="noopener noreferrer" className="font-sans text-[12px] uppercase tracking-widest text-muted hover:text-white transition-colors duration-500">Mail</a>
                    <a href="https://www.linkedin.com/in/krishna-kumar-8352aa33a/" target="_blank" rel="noopener noreferrer" className="font-sans text-[12px] uppercase tracking-widest text-muted hover:text-white transition-colors duration-500">LinkedIn</a>
                </div>
            </div>
        </footer>
    );
}
