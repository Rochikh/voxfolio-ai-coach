import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface PortfolioItem {
  id: string;
  image: string;
  prenom: string;
  created: string;
}

const Showcase = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchPortfolios();
    }
  }, [user, authLoading, navigate]);

  const fetchPortfolios = async () => {
    if (!user) return;

    try {
      // Use the teacher's UUID from Lovable Cloud
      const teacherUUID = user.id;

      console.log("Fetching portfolios for teacher UUID:", teacherUUID);

      // Call Edge Function to fetch portfolios from Airtable filtered by UUID
      const { data, error } = await supabase.functions.invoke('fetch-airtable', {
        body: { 
          teacherId: teacherUUID
        }
      });

      if (error) throw error;

      const mappedPortfolios = data.records.map((record: any) => ({
        id: record.id,
        image: record.image || "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=400&fit=crop",
        prenom: record.prenom,
        created: record.created
      }));

      setPortfolios(mappedPortfolios);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      toast.error("Erreur lors du chargement des portfolios");
      setLoading(false);
    }
  };

  const filteredPortfolios = portfolios.filter((portfolio) =>
    portfolio.prenom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                VOXFOLIO
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Vitrine des portfolios de votre classe
              </p>
            </div>
            <Button
              onClick={() => navigate("/capture")}
              className="gap-2 bg-gradient-primary hover:opacity-90 shadow-primary"
            >
              <Plus className="w-4 h-4" />
              Nouveau Portfolio
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Rechercher un apprenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : filteredPortfolios.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun portfolio trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPortfolios.map((portfolio) => (
              <Card
                key={portfolio.id}
                className="overflow-hidden cursor-pointer hover:shadow-primary transition-all duration-300 hover:scale-105 group"
                onClick={() => {
                  sessionStorage.setItem("airtableRecordId", portfolio.id);
                  navigate("/result");
                }}
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={portfolio.image}
                    alt={`Portfolio de ${portfolio.prenom}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{portfolio.prenom}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(portfolio.created).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Showcase;
