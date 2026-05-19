import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, Calendar, User } from "lucide-react";
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

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:id");
  const id = params?.id || "";
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/blog/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPost(data))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif text-blue-950">Article not found</h2>
          <Link href="/blog" className="text-blue-600 hover:underline mt-4 inline-block">← Back to Journal</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/blog" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Journal
        </Link>

        {post.imageUrl && (
          <div className="rounded-2xl overflow-hidden mb-8 aspect-[16/7]">
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-4xl font-serif text-blue-950 mb-4">{post.title}</h1>

        <div className="flex items-center gap-6 text-sm text-blue-800/60 mb-8 pb-8 border-b border-white/30">
          <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{post.author}</span>
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{new Date(post.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>

        <div className="prose prose-blue max-w-none text-blue-900/80 leading-relaxed space-y-4">
          {post.content.split("\n").map((paragraph, i) => (
            paragraph.trim() ? <p key={i}>{paragraph}</p> : <br key={i} />
          ))}
        </div>
      </div>
    </Layout>
  );
}
