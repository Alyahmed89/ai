export class FlowRunPoller {
  private interval: any = null;
  private isFetching = false;

  start(conversationId: string, cb: (data: any) => void) {
    this.stop();
    
    this.interval = setInterval(async () => {
      if (this.isFetching) return;
      
      this.isFetching = true;
      
      try {
        const flowRunId = conversationId;
        console.log("FLOW RUN ID USED (poller):", flowRunId);
        const res = await fetch(`https://deepseek-agent.alghamdimo89.workers.dev/api/step-runs?flow_run_id=${flowRunId}`);
        const json = await res.json();

        const normalized =
          json?.data?.conversation ??
          json?.conversation ??
          json?.data ??
          json;
        
        cb(normalized);
      } finally {
        this.isFetching = false;
      }
    }, 2000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }
}