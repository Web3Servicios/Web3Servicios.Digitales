use std::convert::Infallible;

use opentelemetry::{
    metrics::Counter,
    sdk::{
        self,
        export::metrics::aggregation,
        metrics::{processors, selectors},
        Resource,
    },
    KeyValue,
};
use opentelemetry_prometheus::PrometheusExporter;
use prometheus_core::TextEncoder;
use tracing_subscriber::EnvFilter;

use {
    opentelemetry::sdk::trace::Tracer as SdkTracer,
    tracing_subscriber::{fmt, prelude::__tracing_subscriber_SubscriberExt, Registry},
};

pub mod prelude {
    pub use tracing::{debug, error, info, trace, warn};
}

pub mod route;

#[derive(Clone, Debug)]
pub struct Metrics {
    pub prometheus_exporter: PrometheusExporter,

    pub requests: Counter<u64>,
}

// Create a new tracing pipeline
pub fn init() -> SdkTracer {
    // Create a new Jaeger exporter pipeline
    let tracer: SdkTracer = opentelemetry_jaeger::new_agent_pipeline()
        .with_service_name("edgerouter.rs")
        .install_simple()
        .unwrap();
    // .install_batch(opentelemetry::runtime::Tokio)

    let subscriber = Registry::default()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,router=debug".into()))
        .with(fmt::Layer::default());

    tracing::subscriber::set_global_default(subscriber).unwrap();

    tracer
}

impl Metrics {
    pub fn new(resource: Resource) -> Result<Self, Infallible> {
        let controller = sdk::metrics::controllers::basic(
            processors::factory(
                selectors::simple::histogram(vec![]),
                aggregation::cumulative_temporality_selector(),
            )
            .with_memory(true),
        )
        .with_resource(resource)
        .build();

        let prometheus_exporter = opentelemetry_prometheus::exporter(controller).init();

        let meter = prometheus_exporter.meter_provider().unwrap();

        opentelemetry::global::set_meter_provider(meter);

        let meter = opentelemetry::global::meter("edgerouter.rs");

        Ok(Metrics {
            prometheus_exporter,
            requests: meter
                .u64_counter("requests")
                .with_description("The number of requests")
                .init(),
        })
    }

    pub fn record_request(&self, cx: &opentelemetry::Context, cached: bool, host: String) {
        self.requests.add(
            cx,
            1,
            &[KeyValue::new("cached", cached), KeyValue::new("host", host)],
        );
    }

    pub fn export(&self) -> Result<String, Infallible> {
        let data = self.prometheus_exporter.registry().gather();
        Ok(TextEncoder::new().encode_to_string(&data).unwrap())
    }
}
