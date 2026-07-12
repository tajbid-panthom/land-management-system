"use client";

export type OwnerDetailsValues = {
  fullName: string;
  fatherOrHusbandName: string;
  motherName: string;
  nid: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  sharePercentage: string;
};

export const EMPTY_OWNER_DETAILS: OwnerDetailsValues = {
  fullName: "",
  fatherOrHusbandName: "",
  motherName: "",
  nid: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  sharePercentage: "100",
};

type OwnerDetailsFieldsProps = {
  values: OwnerDetailsValues;
  onChange: (next: OwnerDetailsValues) => void;
  /** When false, fields are still shown but not HTML-required (server still validates). */
  required?: boolean;
  namePrefix?: string;
  title?: string;
  description?: string;
};

export function OwnerDetailsFields({
  values,
  onChange,
  required = true,
  namePrefix = "owner",
  title = "Property Owner Details",
  description = "Owner information is required when uploading property documents.",
}: OwnerDetailsFieldsProps) {
  const field = (key: keyof OwnerDetailsValues, value: string) =>
    onChange({ ...values, [key]: value });

  const inputClass =
    "mt-1 w-full rounded-md border border-sky-200 px-3 py-2 text-sm";

  return (
    <section className="space-y-3 rounded-md border border-sky-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {description ? (
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          Full Name *
          <input
            name={`${namePrefix}FullName`}
            required={required}
            value={values.fullName}
            onChange={(e) => field("fullName", e.target.value)}
            className={inputClass}
            placeholder="Owner full name"
          />
        </label>
        <label className="block text-sm">
          Father / Husband Name
          <input
            name={`${namePrefix}FatherOrHusbandName`}
            value={values.fatherOrHusbandName}
            onChange={(e) => field("fatherOrHusbandName", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Mother Name
          <input
            name={`${namePrefix}MotherName`}
            value={values.motherName}
            onChange={(e) => field("motherName", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          NID Number
          <input
            name={`${namePrefix}Nid`}
            value={values.nid}
            onChange={(e) => field("nid", e.target.value)}
            className={inputClass}
            placeholder="10, 13, or 17 digits"
          />
        </label>
        <label className="block text-sm">
          Phone
          <input
            name={`${namePrefix}Phone`}
            value={values.phone}
            onChange={(e) => field("phone", e.target.value)}
            className={inputClass}
            placeholder="01XXXXXXXXX"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            name={`${namePrefix}Email`}
            type="email"
            value={values.email}
            onChange={(e) => field("email", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Date of Birth
          <input
            name={`${namePrefix}DateOfBirth`}
            type="date"
            value={values.dateOfBirth}
            onChange={(e) => field("dateOfBirth", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Ownership Share % *
          <input
            name={`${namePrefix}SharePercentage`}
            type="number"
            min={0}
            max={100}
            step="0.01"
            required={required}
            value={values.sharePercentage}
            onChange={(e) => field("sharePercentage", e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
    </section>
  );
}
