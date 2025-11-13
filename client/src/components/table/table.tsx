import { useMemo } from "react";
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from "mantine-react-table";

// useful stuff
//https://www.mantine-react-table.com/docs/guides/async-loading#isloading-ui

interface TableProps<TData extends Record<string, any>>
	extends Omit<Parameters<typeof useMantineReactTable<TData>>[0], "columns" | "data"> {
	columns: MRT_ColumnDef<TData>[];
	data: TData[];
	customHeader?: boolean;
	showTopToolbar?: boolean;
	infiniteLoading?: boolean;
	storeMinMaxValues?: boolean;
	updateMinMaxValues?: (value: any) => void;
	headerAccessorKey?: string;
	formatTheseNumericCols?: String[];
	enableHeaderTooltips?: boolean;
	columnsStateChanges?: any[];
	pagination?: {
		pageIndex: number;
		pageSize: number;
		totalCount: number;
		onPageChange: (page: number) => void;
		onPageSizeChange: (pageSize: number) => void;
		isLoading?: boolean;
	};
}

import React, { useLayoutEffect, useRef, useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { Pagination } from "./pagination";

type TruncatedCellProps = {
	children: string;
};
/**
 * Renders its children on one line with CSS ellipsis.
 * On hover, shows a shadcn Tooltip—but only if the text is actually truncated.
 */
export function TruncatedCell({ children }: TruncatedCellProps) {
	const textRef = useRef<HTMLSpanElement>(null);
	const [isTruncated, setIsTruncated] = useState(false);

	// Check if the text is truncated: scrollWidth > clientWidth
	const checkTruncation = () => {
		const el = textRef.current;
		if (el) {
			setIsTruncated(el.scrollWidth > el.clientWidth);
		}
	};

	// On initial render, and whenever children changes, run checkTruncation:
	useLayoutEffect(() => {
		checkTruncation();
	}, [children]);

	// Use ResizeObserver to detect when the <span>’s size changes (e.g. column resized)
	React.useEffect(() => {
		const el = textRef.current;
		if (!el) return;

		checkTruncation();

		const observer = new ResizeObserver(() => {
			checkTruncation();
		});
		observer.observe(el);

		return () => {
			observer.disconnect();
		};
	}, []);

	const span = (
		<span
			ref={textRef}
			className="block w-full truncate"
			// title provides a native tooltip fallback if needed:
			title={isTruncated ? children : undefined}
		>
			{children}
		</span>
	);

	if (!isTruncated) {
		// If not truncated, just render the span with no Tooltip wrapper.
		return span;
	}

	// Only wrap with Tooltip when truncated
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{span}</TooltipTrigger>
				<TooltipContent side="top" align="center">
					{children}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// Note: if someone face virtualizaiton issue, pass enablePagination = false, Thank me later - Tannu

const Table = <TData extends Record<string, any>>({
	columns = [],
	data = [],
	pagination,
	showTopToolbar = false,
	infiniteLoading = false,
	...mantineTableProps
}: TableProps<TData>) => {
	const footerRef = React.useRef(null)

	const memoColumns = useMemo(() => {
		return columns
	}, [columns]);

	const memoData = useMemo(() => data, [data]);

    const singleRow = memoData?.length === 1


	const table = useMantineReactTable<TData>({
		columns: memoColumns,
		data: memoData,
		enableTopToolbar: false,
		enableBottomToolbar: !!pagination || infiniteLoading,
		enableRowVirtualization: !singleRow,
		enableColumnResizing: true,
        enablePagination: !pagination,
		rowVirtualizerProps: {
			count: memoData.length,
			measureElement: element => {
				return element?.getBoundingClientRect().height;
			},
			overscan: 20,
		},
        
		// mantineTableProps: {
		// 	sx: {
		// 		tableLayout: "fixed",
		// 		width: "100%",
		// 	},
		// },
		
		mantineLoadingOverlayProps: {
			loader: <Loader2 className="animate-spin" />,
			zIndex: 5
		},
		renderEmptyRowsFallback: (props) => {
			return <div className="m-auto">No records found</div>
		},
		// mantineSkeletonProps: {
		// 	hidden: true,
		// },
		...(pagination &&
			typeof pagination === "object" && {
				manualPagination: true,
				rowCount: pagination.totalCount,
				state: {
					pagination: {
						pageIndex: pagination.pageIndex,
						pageSize: pagination.pageSize,
					},
				},
				onPaginationChange: updater => {
					if (typeof updater === "function") {
						const newState = updater({
							pageIndex: pagination.pageIndex,
							pageSize: pagination.pageSize,
						});
						pagination.onPageChange(newState.pageIndex);
						if (newState.pageSize !== pagination.pageSize) {
							pagination.onPageSizeChange(newState.pageSize);
						}
					}
				},
				renderBottomToolbar: () => (
					<Pagination
						currentPage={pagination.pageIndex + 1}
						totalPages={Math.ceil(pagination.totalCount / pagination.pageSize)}
						totalItems={pagination.totalCount}
						pageSize={pagination.pageSize}
						onPageChange={page => pagination.onPageChange(page - 1)}
						onPageSizeChange={pagination.onPageSizeChange}
						isLoading={pagination.isLoading}
						footerRef={footerRef}
					/>
				),
			}),
		...mantineTableProps,
		// mantineTableContainerProps: {
		// 	...mantineTableProps.mantineTableContainerProps,
		// 	sx: {
		// 		...mantineTableProps?.mantineTableContainerProps?.sx,
		// 		position: "static"
		// 	}
		// },
		// mantineTableBodyRowProps: (props) => {
		// 	let returnableData = {}
		// 	if(mantineTableProps.mantineTableBodyRowProps && typeof mantineTableProps.mantineTableBodyRowProps === "function") {
		// 		const data = mantineTableProps.mantineTableBodyRowProps(props);
		// 		returnableData =  data
		// 	}
		// 	if(mantineTableProps.mantineTableBodyRowProps && typeof mantineTableProps.mantineTableBodyRowProps === "object") {
		// 		returnableData =  mantineTableProps.mantineTableBodyRowProps
		// 	}
		// 	// console.log("hi",returnableData, props.row.original)
		// 	if(props.row.original[fake_row_column] == "fake") {
		// 		// console.log("reached me", props.row.original, {
		// 		// 	...returnableData,
		// 		// 	style: {
		// 		// 		...(returnableData?.style ?? {}),
		// 		// 		display: "none"
		// 		// 	}
		// 		// })
		// 		return {
		// 			...returnableData,
		// 			style: {
		// 				...(returnableData?.style ?? {}),
		// 				display: "none"
		// 			}
		// 		}
		// 	}
		// 	return {
		// 		...returnableData,
		// 		className: props.row.getIsSelected() ? "!bg-blue-200 hover:!bg-blue-300 opacity-1" : ""
		// 	}
		// }
    });


	return (
		<div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
			{
				(
					memoData.length <= 2 ? (
						<MantineReactTable key={singleRow ? 'single' : 'multi'} table={table} />
					) : (

						<MantineReactTable key={singleRow ? 'single' : 'multi'} table={table} />
					)
				)
			}
		</div>
	)
	
};

export { Table };
export type { TableProps };