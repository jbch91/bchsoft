CREATE OR REPLACE FUNCTION canonicalize_biomedical_catalog_text(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT TRANSLATE(
    UPPER(
      BTRIM(
        REGEXP_REPLACE(COALESCE(value, ''), '[[:space:]]+', ' ', 'g')
      )
    ),
    'áàäâãåéèëêíìïîóòöôõúùüûñç',
    'ÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ'
  );
$$;

CREATE OR REPLACE FUNCTION normalize_biomedical_catalog_text(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT BTRIM(
    REGEXP_REPLACE(
      LOWER(
        TRANSLATE(
          COALESCE(value, ''),
          'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
          'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc'
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

CREATE TABLE IF NOT EXISTS biomedical_equipment_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS biomedical_equipment_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES biomedical_equipment_catalog(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT biomedical_equipment_brands_equipment_name_uniq
    UNIQUE (equipment_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS biomedical_equipment_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES biomedical_equipment_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT biomedical_equipment_models_brand_name_uniq
    UNIQUE (brand_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_biomedical_equipment_brands_equipment
  ON biomedical_equipment_brands (equipment_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_biomedical_equipment_models_brand
  ON biomedical_equipment_models (brand_id, is_active, name);

CREATE OR REPLACE FUNCTION enforce_biomedical_catalog_name_uppercase()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name = canonicalize_biomedical_catalog_text(NEW.name);
  NEW.normalized_name = normalize_biomedical_catalog_text(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_biomedical_asset_catalog_uppercase()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name = canonicalize_biomedical_catalog_text(NEW.name);
  NEW.brand = CASE
    WHEN NEW.brand IS NULL THEN NULL
    ELSE canonicalize_biomedical_catalog_text(NEW.brand)
  END;
  NEW.model = CASE
    WHEN NEW.model IS NULL THEN NULL
    ELSE canonicalize_biomedical_catalog_text(NEW.model)
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_biomedical_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_biomedical_equipment_catalog_updated_at ON biomedical_equipment_catalog;
CREATE TRIGGER trg_biomedical_equipment_catalog_updated_at
BEFORE UPDATE ON biomedical_equipment_catalog
FOR EACH ROW EXECUTE FUNCTION set_biomedical_catalog_updated_at();

DROP TRIGGER IF EXISTS trg_biomedical_equipment_brands_updated_at ON biomedical_equipment_brands;
CREATE TRIGGER trg_biomedical_equipment_brands_updated_at
BEFORE UPDATE ON biomedical_equipment_brands
FOR EACH ROW EXECUTE FUNCTION set_biomedical_catalog_updated_at();

DROP TRIGGER IF EXISTS trg_biomedical_equipment_models_updated_at ON biomedical_equipment_models;
CREATE TRIGGER trg_biomedical_equipment_models_updated_at
BEFORE UPDATE ON biomedical_equipment_models
FOR EACH ROW EXECUTE FUNCTION set_biomedical_catalog_updated_at();

DROP TRIGGER IF EXISTS trg_biomedical_equipment_catalog_uppercase ON biomedical_equipment_catalog;
CREATE TRIGGER trg_biomedical_equipment_catalog_uppercase
BEFORE INSERT OR UPDATE OF name ON biomedical_equipment_catalog
FOR EACH ROW EXECUTE FUNCTION enforce_biomedical_catalog_name_uppercase();

DROP TRIGGER IF EXISTS trg_biomedical_equipment_brands_uppercase ON biomedical_equipment_brands;
CREATE TRIGGER trg_biomedical_equipment_brands_uppercase
BEFORE INSERT OR UPDATE OF name ON biomedical_equipment_brands
FOR EACH ROW EXECUTE FUNCTION enforce_biomedical_catalog_name_uppercase();

DROP TRIGGER IF EXISTS trg_biomedical_equipment_models_uppercase ON biomedical_equipment_models;
CREATE TRIGGER trg_biomedical_equipment_models_uppercase
BEFORE INSERT OR UPDATE OF name ON biomedical_equipment_models
FOR EACH ROW EXECUTE FUNCTION enforce_biomedical_catalog_name_uppercase();

UPDATE biomedical_equipment_catalog
SET name = canonicalize_biomedical_catalog_text(name)
WHERE name IS DISTINCT FROM canonicalize_biomedical_catalog_text(name);

UPDATE biomedical_equipment_brands
SET name = canonicalize_biomedical_catalog_text(name)
WHERE name IS DISTINCT FROM canonicalize_biomedical_catalog_text(name);

UPDATE biomedical_equipment_models
SET name = canonicalize_biomedical_catalog_text(name)
WHERE name IS DISTINCT FROM canonicalize_biomedical_catalog_text(name);

ALTER TABLE quick_use_guides
  ADD COLUMN IF NOT EXISTS equipment_name_normalized TEXT;
ALTER TABLE quick_use_guides
  ADD COLUMN IF NOT EXISTS equipment_catalog_model_id UUID
    REFERENCES biomedical_equipment_models(id) ON DELETE SET NULL;

ALTER TABLE quick_use_guides
  DROP CONSTRAINT IF EXISTS quick_use_guides_client_brand_model_uniq;
DROP INDEX IF EXISTS quick_use_guides_client_catalog_model_uniq;

UPDATE quick_use_guides
SET equipment_name = canonicalize_biomedical_catalog_text(equipment_name),
    brand = canonicalize_biomedical_catalog_text(brand),
    model = canonicalize_biomedical_catalog_text(model),
    equipment_name_normalized = normalize_biomedical_catalog_text(equipment_name),
    brand_normalized = normalize_biomedical_catalog_text(brand),
    model_normalized = normalize_biomedical_catalog_text(model)
WHERE equipment_name IS DISTINCT FROM canonicalize_biomedical_catalog_text(equipment_name)
   OR brand IS DISTINCT FROM canonicalize_biomedical_catalog_text(brand)
   OR model IS DISTINCT FROM canonicalize_biomedical_catalog_text(model)
   OR equipment_name_normalized IS NULL
   OR equipment_name_normalized <> normalize_biomedical_catalog_text(equipment_name)
   OR brand_normalized <> normalize_biomedical_catalog_text(brand)
   OR model_normalized <> normalize_biomedical_catalog_text(model);

ALTER TABLE quick_use_guides
  ALTER COLUMN equipment_name_normalized SET NOT NULL;

CREATE OR REPLACE FUNCTION enforce_quick_use_guide_catalog_uppercase()
RETURNS TRIGGER AS $$
BEGIN
  NEW.equipment_name = canonicalize_biomedical_catalog_text(NEW.equipment_name);
  NEW.brand = canonicalize_biomedical_catalog_text(NEW.brand);
  NEW.model = canonicalize_biomedical_catalog_text(NEW.model);
  NEW.equipment_name_normalized = normalize_biomedical_catalog_text(NEW.equipment_name);
  NEW.brand_normalized = normalize_biomedical_catalog_text(NEW.brand);
  NEW.model_normalized = normalize_biomedical_catalog_text(NEW.model);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quick_use_guides_catalog_uppercase ON quick_use_guides;
CREATE TRIGGER trg_quick_use_guides_catalog_uppercase
BEFORE INSERT OR UPDATE OF equipment_name, brand, model ON quick_use_guides
FOR EACH ROW EXECUTE FUNCTION enforce_quick_use_guide_catalog_uppercase();

INSERT INTO biomedical_equipment_catalog (name, normalized_name)
SELECT MIN(canonicalize_biomedical_catalog_text(equipment_name)), normalize_biomedical_catalog_text(equipment_name)
FROM quick_use_guides
WHERE normalize_biomedical_catalog_text(equipment_name) <> ''
GROUP BY normalize_biomedical_catalog_text(equipment_name)
ON CONFLICT (normalized_name) DO UPDATE
SET name = EXCLUDED.name,
    is_active = TRUE;

INSERT INTO biomedical_equipment_brands (equipment_id, name, normalized_name)
SELECT e.id,
       MIN(canonicalize_biomedical_catalog_text(g.brand)),
       normalize_biomedical_catalog_text(g.brand)
FROM quick_use_guides g
JOIN biomedical_equipment_catalog e
  ON e.normalized_name = normalize_biomedical_catalog_text(g.equipment_name)
WHERE normalize_biomedical_catalog_text(g.brand) <> ''
GROUP BY e.id, normalize_biomedical_catalog_text(g.brand)
ON CONFLICT (equipment_id, normalized_name) DO UPDATE
SET name = EXCLUDED.name,
    is_active = TRUE;

INSERT INTO biomedical_equipment_models (brand_id, name, normalized_name)
SELECT b.id,
       MIN(canonicalize_biomedical_catalog_text(g.model)),
       normalize_biomedical_catalog_text(g.model)
FROM quick_use_guides g
JOIN biomedical_equipment_catalog e
  ON e.normalized_name = normalize_biomedical_catalog_text(g.equipment_name)
JOIN biomedical_equipment_brands b
  ON b.equipment_id = e.id
 AND b.normalized_name = normalize_biomedical_catalog_text(g.brand)
WHERE normalize_biomedical_catalog_text(g.model) <> ''
GROUP BY b.id, normalize_biomedical_catalog_text(g.model)
ON CONFLICT (brand_id, normalized_name) DO UPDATE
SET name = EXCLUDED.name,
    is_active = TRUE;

DO $$
DECLARE
  client_schema RECORD;
BEGIN
  FOR client_schema IN
    SELECT schema_name
    FROM clients
    WHERE schema_name ~ '^[a-zA-Z0-9_]+$'
  LOOP
    IF to_regclass(format('%I.%I', client_schema.schema_name, 'assets')) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.assets ADD COLUMN IF NOT EXISTS equipment_catalog_model_id UUID REFERENCES public.biomedical_equipment_models(id) ON DELETE SET NULL',
      client_schema.schema_name
    );

    EXECUTE format($uppercase_assets$
      UPDATE %I.assets
      SET name = public.canonicalize_biomedical_catalog_text(name),
          brand = CASE
            WHEN brand IS NULL THEN NULL
            ELSE public.canonicalize_biomedical_catalog_text(brand)
          END,
          model = CASE
            WHEN model IS NULL THEN NULL
            ELSE public.canonicalize_biomedical_catalog_text(model)
          END
      WHERE name IS DISTINCT FROM public.canonicalize_biomedical_catalog_text(name)
         OR brand IS DISTINCT FROM CASE
              WHEN brand IS NULL THEN NULL
              ELSE public.canonicalize_biomedical_catalog_text(brand)
            END
         OR model IS DISTINCT FROM CASE
              WHEN model IS NULL THEN NULL
              ELSE public.canonicalize_biomedical_catalog_text(model)
            END
    $uppercase_assets$, client_schema.schema_name);

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_assets_catalog_uppercase ON %I.assets',
      client_schema.schema_name
    );
    EXECUTE format(
      'CREATE TRIGGER trg_assets_catalog_uppercase BEFORE INSERT OR UPDATE OF name, brand, model ON %I.assets FOR EACH ROW EXECUTE FUNCTION public.enforce_biomedical_asset_catalog_uppercase()',
      client_schema.schema_name
    );

    EXECUTE format($catalog_equipment$
      INSERT INTO public.biomedical_equipment_catalog (name, normalized_name)
      SELECT MIN(public.canonicalize_biomedical_catalog_text(name)), public.normalize_biomedical_catalog_text(name)
      FROM %I.assets
      WHERE public.normalize_biomedical_catalog_text(name) <> ''
      GROUP BY public.normalize_biomedical_catalog_text(name)
      ON CONFLICT (normalized_name) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = TRUE
    $catalog_equipment$, client_schema.schema_name);

    EXECUTE format($catalog_brand$
      INSERT INTO public.biomedical_equipment_brands (equipment_id, name, normalized_name)
      SELECT e.id,
             MIN(public.canonicalize_biomedical_catalog_text(a.brand)),
             public.normalize_biomedical_catalog_text(a.brand)
      FROM %I.assets a
      JOIN public.biomedical_equipment_catalog e
        ON e.normalized_name = public.normalize_biomedical_catalog_text(a.name)
      WHERE public.normalize_biomedical_catalog_text(a.brand) <> ''
      GROUP BY e.id, public.normalize_biomedical_catalog_text(a.brand)
      ON CONFLICT (equipment_id, normalized_name) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = TRUE
    $catalog_brand$, client_schema.schema_name);

    EXECUTE format($catalog_model$
      INSERT INTO public.biomedical_equipment_models (brand_id, name, normalized_name)
      SELECT b.id,
             MIN(public.canonicalize_biomedical_catalog_text(a.model)),
             public.normalize_biomedical_catalog_text(a.model)
      FROM %I.assets a
      JOIN public.biomedical_equipment_catalog e
        ON e.normalized_name = public.normalize_biomedical_catalog_text(a.name)
      JOIN public.biomedical_equipment_brands b
        ON b.equipment_id = e.id
       AND b.normalized_name = public.normalize_biomedical_catalog_text(a.brand)
      WHERE public.normalize_biomedical_catalog_text(a.model) <> ''
      GROUP BY b.id, public.normalize_biomedical_catalog_text(a.model)
      ON CONFLICT (brand_id, normalized_name) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = TRUE
    $catalog_model$, client_schema.schema_name);

    EXECUTE format($catalog_link$
      UPDATE %I.assets a
      SET equipment_catalog_model_id = m.id
      FROM public.biomedical_equipment_catalog e
      JOIN public.biomedical_equipment_brands b ON b.equipment_id = e.id
      JOIN public.biomedical_equipment_models m ON m.brand_id = b.id
      WHERE e.normalized_name = public.normalize_biomedical_catalog_text(a.name)
        AND b.normalized_name = public.normalize_biomedical_catalog_text(a.brand)
        AND m.normalized_name = public.normalize_biomedical_catalog_text(a.model)
        AND a.equipment_catalog_model_id IS DISTINCT FROM m.id
    $catalog_link$, client_schema.schema_name);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_assets_equipment_catalog_model_id ON %I.assets (equipment_catalog_model_id)',
      client_schema.schema_name
    );
  END LOOP;
END $$;

UPDATE quick_use_guides g
SET equipment_catalog_model_id = m.id
FROM biomedical_equipment_catalog e
JOIN biomedical_equipment_brands b ON b.equipment_id = e.id
JOIN biomedical_equipment_models m ON m.brand_id = b.id
WHERE e.normalized_name = normalize_biomedical_catalog_text(g.equipment_name)
  AND b.normalized_name = normalize_biomedical_catalog_text(g.brand)
  AND m.normalized_name = normalize_biomedical_catalog_text(g.model)
  AND g.equipment_catalog_model_id IS DISTINCT FROM m.id;

WITH ranked_guides AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY client_id, equipment_catalog_model_id
           ORDER BY updated_at DESC, created_at DESC, id
         ) AS duplicate_position
  FROM quick_use_guides
  WHERE equipment_catalog_model_id IS NOT NULL
)
UPDATE quick_use_guides g
SET equipment_catalog_model_id = NULL
FROM ranked_guides ranked
WHERE ranked.id = g.id
  AND ranked.duplicate_position > 1;

ALTER TABLE quick_use_guides
  DROP CONSTRAINT IF EXISTS quick_use_guides_client_brand_model_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS quick_use_guides_client_catalog_model_uniq
  ON quick_use_guides (client_id, equipment_catalog_model_id)
  WHERE equipment_catalog_model_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quick_use_guides_equipment_match
  ON quick_use_guides (
    client_id,
    equipment_name_normalized,
    brand_normalized,
    model_normalized,
    status
  );
