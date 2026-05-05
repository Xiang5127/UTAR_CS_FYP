## Table `delivery_records`

CREATE TABLE public.delivery_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  image_url text NOT NULL,
  image_hash text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude double precision,
  gps_accuracy_metres double precision,
  captured_at timestamp with time zone NOT NULL,
  accuracy_status text NOT NULL CHECK (accuracy_status = ANY (ARRAY['precise'::text, 'override'::text])),
  tracking_number text,
  CONSTRAINT delivery_records_pkey PRIMARY KEY (id)
);



## Table `field_test_records`

CREATE TABLE public.field_test_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_url text,
  image_hash text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude double precision,
  gps_accuracy_metres double precision,
  captured_at timestamp with time zone NOT NULL,
  accuracy_status text NOT NULL,
  tracking_number text NOT NULL,
  model_confidence double precision NOT NULL,
  building_detected boolean NOT NULL,
  detection_overridden boolean NOT NULL DEFAULT false,
  ground_truth_is_building boolean,
  barcode_scan_ms double precision,
  gps_fix_ms double precision,
  time_to_capture_ms double precision,
  upload_latency_ms double precision,
  exif_write_ms double precision,
  battery_level double precision,
  upload_success boolean DEFAULT false,
  gps_speed double precision,
  gps_heading double precision,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT field_test_records_pkey PRIMARY KEY (id)
);

