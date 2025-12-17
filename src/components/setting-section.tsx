interface SettingSectionProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({ title, icon, extra, children }) => {
  return (
    <section>
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-2 backdrop-blur-sm">
        {icon}
        <span className="font-medium text-sm">{title}</span>
        {extra}
      </div>
      {children}
    </section>
  );
};
