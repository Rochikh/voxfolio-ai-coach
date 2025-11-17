import { TeacherNav } from "@/components/TeacherNav";

export default function Help() {
  return (
    <div className="min-h-screen bg-background">
      <TeacherNav />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-6 text-primary">Guide d'utilisation Voxfolio</h1>
          <p className="text-lg text-muted-foreground mb-8">Pour les formateurs</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Connexion à la plateforme</h2>
            
            <h3 className="text-xl font-medium mb-3 text-foreground">Première connexion</h3>
            <ol className="list-decimal list-inside space-y-2 mb-4 text-foreground">
              <li>Rendez-vous sur la page de connexion</li>
              <li>Cliquez sur "S'inscrire"</li>
              <li>Renseignez vos informations : Prénom, Nom, Email professionnel, Mot de passe sécurisé</li>
              <li>Validez votre inscription</li>
              <li>Vous serez automatiquement connecté avec le rôle "Enseignant"</li>
            </ol>

            <h3 className="text-xl font-medium mb-3 text-foreground">Connexions suivantes</h3>
            <ol className="list-decimal list-inside space-y-2 text-foreground">
              <li>Entrez votre email et mot de passe</li>
              <li>Cliquez sur "Se connecter"</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Tableau de bord</h2>
            <p className="mb-4 text-foreground">Après connexion, vous accédez à votre tableau de bord qui présente trois fonctionnalités principales :</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <h4 className="font-semibold text-foreground">Générer des QR Codes</h4>
                  <p className="text-muted-foreground">Créez des QR codes pour vos classes afin que vos apprenants puissent accéder facilement à la plateforme.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">👥</span>
                <div>
                  <h4 className="font-semibold text-foreground">Gérer vos classes</h4>
                  <p className="text-muted-foreground">Créez, modifiez et organisez vos groupes d'apprenants.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎨</span>
                <div>
                  <h4 className="font-semibold text-foreground">Voir les productions</h4>
                  <p className="text-muted-foreground">Consultez les portfolios créés par vos apprenants.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Gestion des classes</h2>
            
            <h3 className="text-xl font-medium mb-3 text-foreground">Créer une classe</h3>
            <ol className="list-decimal list-inside space-y-2 mb-4 text-foreground">
              <li>Cliquez sur "Classes" dans le menu de navigation</li>
              <li>Cliquez sur le bouton "Créer une classe"</li>
              <li>Entrez le nom de votre classe (ex: "BTS SIO 1A", "Licence Pro Multimédia")</li>
              <li>Validez</li>
            </ol>

            <h3 className="text-xl font-medium mb-3 text-foreground">Consulter vos classes</h3>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>La liste de toutes vos classes s'affiche sur la page</li>
              <li>Chaque classe indique son nom et sa date de création</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 text-foreground">Modifier ou supprimer une classe</h3>
            <p className="text-foreground">Utilisez les boutons d'action à côté de chaque classe. Les modifications sont instantanées.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Génération de QR Codes</h2>
            <p className="mb-4 text-foreground">Les QR codes permettent à vos apprenants d'accéder facilement à la plateforme de capture.</p>
            
            <h3 className="text-xl font-medium mb-3 text-foreground">Générer un QR code</h3>
            <ol className="list-decimal list-inside space-y-2 mb-4 text-foreground">
              <li>Accédez à la page "QR Code" via le menu</li>
              <li>Sélectionnez la classe concernée dans la liste déroulante</li>
              <li>Le QR code se génère automatiquement</li>
              <li>Téléchargez-le en cliquant sur "Télécharger le QR Code"</li>
            </ol>

            <h3 className="text-xl font-medium mb-3 text-foreground">Utilisation du QR code</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground">
              <li>Affichez le QR code en classe (projecteur, impression)</li>
              <li>Les apprenants scannent le code avec leur smartphone</li>
              <li>Ils sont dirigés vers la page de capture pour enregistrer leur présentation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Consultation des productions</h2>
            
            <h3 className="text-xl font-medium mb-3 text-foreground">Accéder aux productions</h3>
            <ol className="list-decimal list-inside space-y-2 mb-4 text-foreground">
              <li>Cliquez sur "Productions" dans le menu</li>
              <li>Sélectionnez une classe pour filtrer les résultats</li>
              <li>Consultez la liste des portfolios créés</li>
            </ol>

            <h3 className="text-xl font-medium mb-3 text-foreground">Que contiennent les productions ?</h3>
            <p className="mb-3 text-foreground">Chaque production générée par un apprenant contient :</p>
            <ul className="list-disc list-inside space-y-2 text-foreground">
              <li><strong>Un visuel professionnel</strong> généré par IA</li>
              <li><strong>Un feedback détaillé</strong> sur la présentation orale</li>
              <li><strong>La transcription</strong> complète de l'enregistrement</li>
              <li><strong>Les étapes du parcours</strong> extraites automatiquement</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Processus pour l'apprenant</h2>
            <p className="mb-3 text-foreground">Comment un apprenant crée son portfolio :</p>
            <ol className="list-decimal list-inside space-y-2 text-foreground">
              <li><strong>Scan du QR code</strong> généré par le formateur</li>
              <li><strong>Accès à la page de capture</strong></li>
              <li><strong>Enregistrement vocal</strong> de sa présentation (parcours, compétences, projets)</li>
              <li><strong>Traitement IA</strong> automatique :
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-muted-foreground">
                  <li>Transcription de l'audio</li>
                  <li>Analyse du contenu</li>
                  <li>Génération d'un visuel professionnel</li>
                  <li>Extraction des étapes du parcours</li>
                </ul>
              </li>
              <li><strong>Consultation du résultat</strong> :
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-muted-foreground">
                  <li>Visuel téléchargeable</li>
                  <li>Feedback personnalisé</li>
                  <li>Transcription complète</li>
                  <li>Étapes numérotées</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Conseils pédagogiques</h2>
            
            <h3 className="text-xl font-medium mb-3 text-foreground">Préparer vos apprenants</h3>
            <p className="mb-3 text-foreground">Expliquez l'objectif : créer un portfolio professionnel valorisant.</p>
            <p className="mb-2 text-foreground">Donnez des conseils pour l'enregistrement :</p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Parler clairement et distinctement</li>
              <li>Structurer son discours (introduction, parcours, compétences, projets)</li>
              <li>Durée recommandée : 2-5 minutes</li>
              <li>Environnement calme sans bruit de fond</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 text-foreground">Exploiter les résultats</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground">
              <li>Utilisez les feedbacks IA comme base de discussion</li>
              <li>Encouragez les apprenants à itérer et améliorer</li>
              <li>Les visuels peuvent être utilisés pour des CV ou profils LinkedIn</li>
              <li>Les transcriptions aident à identifier les points d'amélioration</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Questions fréquentes</h2>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Q : Combien de classes puis-je créer ?</h4>
                <p className="text-muted-foreground">R : Il n'y a pas de limite au nombre de classes.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-1">Q : Les QR codes expirent-ils ?</h4>
                <p className="text-muted-foreground">R : Non, les QR codes sont permanents et peuvent être réutilisés.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-1">Q : Puis-je modifier un portfolio après sa création ?</h4>
                <p className="text-muted-foreground">R : Les apprenants peuvent créer de nouveaux portfolios à tout moment.</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-foreground mb-1">Q : Où sont stockées les données ?</h4>
                <p className="text-muted-foreground">R : Toutes les données sont stockées de manière sécurisée dans le cloud.</p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Support et assistance</h2>
            
            <h3 className="text-xl font-medium mb-3 text-foreground">En cas de problème</h3>
            <ul className="list-disc list-inside space-y-2 text-foreground">
              <li>Vérifiez votre connexion internet</li>
              <li>Assurez-vous que les apprenants ont autorisé l'accès au microphone</li>
              <li>Les enregistrements peuvent prendre quelques minutes à être traités</li>
            </ul>
          </section>

          <div className="mt-12 pt-6 border-t border-border text-center">
            <p className="text-lg font-semibold text-primary">Voxfolio</p>
            <p className="text-muted-foreground">Transformez la voix en portfolio professionnel 🎙️✨</p>
          </div>
        </div>
      </div>
    </div>
  );
}
