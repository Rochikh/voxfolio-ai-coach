import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Users, GraduationCap, BookOpen, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TeacherNav } from "@/components/TeacherNav";

interface UserWithRole {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  classe: string | null;
  created_at: string;
  user_roles: { role: string }[];
  classes: { id: string; nom: string }[];
}

interface Stats {
  totalUsers: number;
  totalEnseignants: number;
  totalApprenants: number;
  totalClasses: number;
}

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalEnseignants: 0,
    totalApprenants: 0,
    totalClasses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    if (loading) return;

    // Vérification d'accès
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.email !== "contact@rochane.fr") {
      navigate("/dashboard");
      return;
    }

    fetchData();
  }, [user, loading, navigate]);

  useEffect(() => {
    // Filtrage des utilisateurs
    let filtered = users;

    // Filtre par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.email.toLowerCase().includes(search) ||
          u.prenom?.toLowerCase().includes(search) ||
          u.nom?.toLowerCase().includes(search)
      );
    }

    // Filtre par rôle
    if (roleFilter !== "all") {
      filtered = filtered.filter((u) => u.user_roles[0]?.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Récupération des statistiques
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: totalEnseignants } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "enseignant");

      const { count: totalApprenants } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "apprenant");

      const { count: totalClasses } = await supabase
        .from("classes")
        .select("*", { count: "exact", head: true });

      setStats({
        totalUsers: totalUsers || 0,
        totalEnseignants: totalEnseignants || 0,
        totalApprenants: totalApprenants || 0,
        totalClasses: totalClasses || 0,
      });

      // Récupération de la liste des utilisateurs
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Récupération des rôles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Récupération des classes
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("teacher_id, id, nom");

      if (classesError) throw classesError;

      // Joindre les données côté client
      const usersWithRoles = profilesData?.map((profile) => ({
        ...profile,
        user_roles: rolesData?.filter((r) => r.user_id === profile.id) || [],
        classes: classesData?.filter((c) => c.teacher_id === profile.id) || [],
      })) || [];

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getRoleBadge = (role: string) => {
    if (role === "enseignant") {
      return <Badge variant="default">Enseignant</Badge>;
    }
    return <Badge variant="secondary">Apprenant</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <TeacherNav />
      
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Administration</h1>
            <p className="text-muted-foreground">Gestion des utilisateurs et statistiques</p>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enseignants</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalEnseignants}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Apprenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalApprenants}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Classes Créées</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalClasses}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Liste des utilisateurs */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
            <CardDescription>
              Tous les utilisateurs inscrits sur la plateforme
            </CardDescription>
            
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrer par rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  <SelectItem value="enseignant">Enseignants</SelectItem>
                  <SelectItem value="apprenant">Apprenants</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun utilisateur trouvé
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead className="text-center">Classes créées</TableHead>
                      <TableHead>Inscription</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          {user.prenom && user.nom
                            ? `${user.prenom} ${user.nom}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {user.user_roles[0]
                            ? getRoleBadge(user.user_roles[0].role)
                            : "-"}
                        </TableCell>
                        <TableCell>{user.classe || "-"}</TableCell>
                        <TableCell className="text-center">
                          {user.classes?.length || 0}
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
