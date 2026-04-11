export class FlowRunPoller {
  private interval: any = null;
  private isFetching = false;

  start(conversationId: string, cb: (data: any) => void) {
    this.stop();
    
    this.interval = setInterval(async () => {
      if (this.isFetching) return;
      
      this.isFetching = true;
      
      try {
        const res = await fetch(`/api/proxy/status/${conversationId}`);
        const json = await res.json();
        
        cb(json.data);
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