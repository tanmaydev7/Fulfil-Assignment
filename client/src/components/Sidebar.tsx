import { Link, useLocation } from "react-router";
import { Package, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const location = useLocation();

  const navigation = [
    {
      name: "Products",
      href: "/products",
      icon: Package,
    },
    {
      name: "Webhooks",
      href: "/webhooks",
      icon: Webhook,
    },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-background">
      {/* Company Header */}
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-semibold">Acme Inc.</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href === "/products" && location.pathname === "/");
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

