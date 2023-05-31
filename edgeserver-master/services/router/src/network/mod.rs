use {
    crate::AppState,
    http::{Request, Response},
    http_body_util::Full,
    hyper::body::{Bytes, Incoming},
    std::sync::Arc,
};

pub mod measure;
pub mod route;
pub mod resolve;

use crate::error::Error;

#[derive(Debug)]
pub struct RequestData {
    host: String,
}

#[derive(Debug, thiserror::Error)]
pub enum NetworkError {
    #[error("Missing host")]
    NoHost,
}

pub fn extract_host<T>(req: Request<T>) -> Result<(Request<T>, String), Error> {
    let host = req.headers().get("Host");

    match host {
        Some(host) => {
            let host = host.to_str().unwrap().to_string();
            Ok((req, host))
        }
        None => Err(Error::NetworkError(NetworkError::NoHost)),
    }
}

// Handle incoming HTTP requests
pub async fn handle_svc(
    request: Request<Incoming>,
    state: &Arc<AppState>,
) -> Result<Response<Full<Bytes>>, hyper::Error> {
    // Start metrics recording and extract host
    let (start_time, request, host, span) = measure::record_metrics(request, state).await;

    let data = RequestData { host };

    // Handle the request
    let (response, cx) = route::handle(request, data, span, state.clone())
        .await
        .unwrap();

    // Post metrics
    let _span = measure::post_metrics(&response, &cx, start_time);

    // Return the response
    Ok(response)
}
