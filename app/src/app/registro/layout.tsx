export default function RegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header oficial */}
      <header className="w-full py-4 px-6 flex items-center justify-center border-b border-primary-900/40 bg-surface-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img
            src="/logo/logo.jpg"
            alt="Logo Fuerza Tacna"
            className="w-11 h-11 rounded-xl object-cover border border-accent-400/50 shadow-md shadow-accent-500/20"
          />
          <div>
            <h1 className="text-lg font-black text-[#f8f9f9] tracking-wide leading-tight">FUERZA TACNA</h1>
            <p className="text-[10px] text-accent-400 font-bold uppercase tracking-widest">Padrón Oficial de Militantes</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-primary-300/60 border-t border-primary-900/30">
        © {new Date().getFullYear()} Fuerza Tacna · Unidos por el Desarrollo y la Dignidad de Nuestra Región
      </footer>
    </div>
  );
}
