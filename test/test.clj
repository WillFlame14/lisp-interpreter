(let [add3 (fn rec [x i]
						(if (= i 3)
							x
							(rec (+ x 1) (+ i 1))))
     	z 24]
     	(add3 z 0))