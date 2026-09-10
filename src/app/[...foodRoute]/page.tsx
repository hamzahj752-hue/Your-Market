import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import ProductGrid from '@/app/products/components/ProductGrid';
import Icon from '@/components/ui/AppIcon';
import { fetchFoodCategoryBySlug, fetchFoodCategoryProducts } from '@/lib/homepageCms';

/*
 * Food category landing page.
 *
 * URL shape: /{slug}page/all{slug}   (e.g. /biryanipage/allbiryani,
 * /momopage/allmomo). Next.js dynamic segments must be whole folders
 * (`[slug]`), so the partial-dynamic `{slug}page` / `all{slug}` segments
 * cannot be expressed as folders. This page is therefore a root catch-all
 * (`[...foodRoute]`) that validates the shape at runtime and derives the real
 * category slug — segments "momopage" / "allmomo" resolve to slug "momo".
 * A new Food category created from Admin (or any slug change) works
 * automatically: the slug is resolved at runtime against the canonical
 * homepage_food_categories source; nothing here is hard-coded.
 *
 * Fed exclusively by REAL data:
 *  - the food category comes from the independent homepage_food_categories row
 *    (matched by its own slug) — NOT the shared categories table,
 *  - every product on the page is a real active product whose food_category_id
 *    matches that category,
 *  - an unknown slug / malformed path is a genuine 404; a valid category with
 *    no products shows an honest empty state — nothing is ever fabricated.
 */

interface PageProps {
  params: Promise<{ foodRoute: string[] }>;
}

const siteName = 'Your Market';

const STORE_SEGMENT = /^(.+)page$/;
const ALL_SEGMENT = /^all(.+)$/;

// The canonical href is `/{slug}page/all{slug}` — two segments where the first
// ends in "page" and the second starts with "all", both carrying the SAME slug.
function slugFromSegments(segments: string[] | undefined): string | null {
  if (!segments || segments.length !== 2) return null;
  const store = STORE_SEGMENT.exec(segments[0]);
  const list = ALL_SEGMENT.exec(segments[1]);
  if (!store || !list || store[1] !== list[1]) return null;
  return store[1];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { foodRoute } = await params;
  const slug = slugFromSegments(foodRoute);
  const category = slug ? await fetchFoodCategoryBySlug(slug) : null;

  if (!category || !category.name) notFound();

  return {
    title: `${category.name} - ${siteName}`,
    description: `Shop ${category.name} at ${siteName}.`,
  };
}

export default async function FoodCategoryPage({ params }: PageProps) {
  const { foodRoute } = await params;
  const slug = slugFromSegments(foodRoute);
  const category = slug ? await fetchFoodCategoryBySlug(slug) : null;

  if (!category || !category.name) notFound();

  const products = await fetchFoodCategoryProducts(category.id);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pb-24 lg:pb-0">
        <div className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-primary font-600">
                Home
              </Link>

              <span>/</span>

              <Link href="/food" className="hover:text-primary font-600">
                Food
              </Link>

              <span>/</span>

              <span className="font-700 text-foreground">{category.name}</span>
            </nav>

            <h1 className="text-2xl font-800 text-foreground">{category.name}</h1>

            {category.notice && category.notice.trim() && (
              <p className="mt-3 max-w-2xl rounded-xl bg-primary/5 px-4 py-3 text-sm font-600 text-foreground leading-relaxed break-words">
                {category.notice.trim()}
              </p>
            )}

            <p className="text-muted-foreground text-sm mt-1">
              {products.length.toLocaleString()} {products.length === 1 ? 'product' : 'products'}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 px-4 text-center">
              <Icon
                name="MagnifyingGlassIcon"
                size={44}
                className="text-muted-foreground/30 mb-4"
              />

              <h2 className="text-lg font-700 text-foreground mb-2">No products yet</h2>

              <p className="text-muted-foreground text-sm max-w-xs">
                Products in this category will appear here as soon as they are listed.
              </p>

              <Link
                href="/food"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-700 text-primary-foreground transition-colors hover:bg-blue-600"
              >
                Browse food categories
                <Icon name="ArrowRightIcon" size={16} />
              </Link>
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
