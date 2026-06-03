import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { BookOpen, Calendar, User } from "lucide-react";
import { apiFetch } from "@/lib/api";

type BlogPost = {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string | null;
  author: string;
  published: boolean;
  createdAt: string;
};

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/blog")
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-serif text-foreground mb-2 text-center">Fragrance Journal</h1>
        <p className="text-center text-muted-foreground mb-12">Tips, stories and guides from the world of perfumery</p>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center">
            <BookOpen className="w-16 h-16 text-blue-200 mx-auto mb-6" />
            <h2 className="text-2xl font-serif text-foreground mb-4">No articles yet</h2>
            <p className="text-muted-foreground">Check back soon for fragrance tips and stories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.id}`}>
                <div className="glass-card rounded-2xl overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow">
                  {post.imageUrl ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-blue-900/40 to-blue-800/30 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-blue-400" />
                    </div>
                  )}
                  <div className="p-6">
                    <h2 className="text-xl font-serif text-foreground mb-2 group-hover:text-sky-300 transition-colors">{post.title}</h2>
                    <p className="text-foreground/60 text-sm mb-4 line-clamp-2">{post.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
