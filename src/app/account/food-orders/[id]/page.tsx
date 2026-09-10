import FoodOrderDetailsClient from './FoodOrderDetailsClient';

export default async function FoodOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <FoodOrderDetailsClient id={id} />;
}
