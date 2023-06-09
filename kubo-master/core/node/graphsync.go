package node

import (
	blockstore "github.com/ipfs/boxo/blockstore"
	"github.com/ipfs/go-graphsync"
	gsimpl "github.com/ipfs/go-graphsync/impl"
	"github.com/ipfs/go-graphsync/network"
	"github.com/ipfs/go-graphsync/storeutil"
	libp2p "github.com/libp2p/go-libp2p/core"
	"go.uber.org/fx"

	"github.com/ipfs/kubo/core/node/helpers"
)

// Graphsync constructs a graphsync
func Graphsync(lc fx.Lifecycle, mctx helpers.MetricsCtx, host libp2p.Host, bs blockstore.GCBlockstore) graphsync.GraphExchange {
	ctx := helpers.LifecycleCtx(mctx, lc)

	network := network.NewFromLibp2pHost(host)
	return gsimpl.New(ctx, network,
		storeutil.LinkSystemForBlockstore(bs),
	)
}
