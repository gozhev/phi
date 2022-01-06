include make.mk/make.mk

$.go = go build

$(go_binary)
	name = psi
	srcs = main.go
$;
