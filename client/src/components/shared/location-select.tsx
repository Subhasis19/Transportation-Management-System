import type { ComponentPropsWithoutRef } from "react";
import { Field } from "@/components/shared/field";
import type { Location } from "@/types/domain";

type LocationSelectProps = {
  label: string;
  locations: Location[];
} & ComponentPropsWithoutRef<"select">;

export function LocationSelect({
  label,
  locations,
  ...props
}: LocationSelectProps) {
  return (
    <Field label={label}>
      <select
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        {...props}
      >
        <option value="">Select city</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.cityName}
          </option>
        ))}
      </select>
    </Field>
  );
}
