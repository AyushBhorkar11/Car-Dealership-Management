import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { catalogueQuery } from '@/lib/catalogue-query';
import { ModelDetailView } from '@/components/cdms/model-detail-view';
import { getModelSlug, type PublicCar } from '@/lib/catalogue.functions';

export const Route = createFileRoute('/cars/$id')({
  head: () => ({
    meta: [
      { title: 'Vehicle Model Details — CDMS Catalogue' },
      {
        name: 'description',
        content:
          'Explore specifications, live branch inventory, variant comparison, and direct booking for new vehicles.',
      },
      { property: 'og:title', content: 'Vehicle Model Details — CDMS Catalogue' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(catalogueQuery);
    return { ...data, id: params.id };
  },
  component: CarModelRoute,
});

function CarModelRoute() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(catalogueQuery);

  // 1. Try resolving by car UUID
  const carById = data.cars.find((c: PublicCar) => c.id === id);

  // 2. Try resolving by model slug (e.g. 'audi-a4', 'hyundai-creta')
  let brand: string | undefined;
  let modelName: string | undefined;

  if (carById) {
    brand = carById.brand;
    modelName = carById.model;
  } else {
    // Check against data.models or car slugs
    const foundModel = data.models.find((m) => m.slug === id);
    if (foundModel) {
      brand = foundModel.brand;
      modelName = foundModel.model;
    } else {
      // Fallback matching
      const matchingCar = data.cars.find(
        (c: PublicCar) => getModelSlug(c.brand, c.model) === id.toLowerCase()
      );
      if (matchingCar) {
        brand = matchingCar.brand;
        modelName = matchingCar.model;
      }
    }
  }

  if (!brand || !modelName) {
    return (
      <main className="content-width page-body py-16 text-center">
        <h1 className="text-2xl font-light text-foreground mb-3">Model Not Found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The requested vehicle or model could not be found in our current catalogue.
        </p>
        <Link
          to="/cars"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background text-xs font-medium"
        >
          Return to the collection
        </Link>
      </main>
    );
  }

  const model = data.models.find(
    (m) => m.brand.toLowerCase() === brand!.toLowerCase() && m.model.toLowerCase() === modelName!.toLowerCase()
  ) || data.models[0];

  const modelCars = data.cars.filter(
    (c: PublicCar) =>
      c.brand.toLowerCase() === brand!.toLowerCase() &&
      c.model.toLowerCase() === modelName!.toLowerCase()
  );

  return (
    <ModelDetailView
      model={model}
      modelCars={modelCars}
      branches={data.branches}
      initialCarId={carById?.id}
    />
  );
}
